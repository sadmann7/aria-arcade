// The interface between Woof and Aria Arcade's Doom grid. Each tic it writes
// the player, the monsters, items and doors near them as JSON for the page,
// and it turns the grid's requests into the player's ticcmd.

#include <emscripten.h>
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "d_event.h"
#include "d_player.h"
#include "d_think.h"
#include "d_ticcmd.h"
#include "doom_grid.h"
#include "doomdata.h"
#include "doomstat.h"
#include "g_game.h"
#include "i_timer.h"
#include "info.h"
#include "m_fixed.h"
#include "p_map.h"
#include "p_maputl.h"
#include "p_mobj.h"
#include "p_tick.h"
#include "r_defs.h"
#include "r_main.h"
#include "r_state.h"
#include "tables.h"

#define EXPORT EMSCRIPTEN_KEEPALIVE

// The grid is 24 cells of 64 units across and only recenters once the player
// is 5 cells from an edge, so this reaches one cell past its far side.
#define RANGE (20 * 64)
#define MAX_THINGS 192
#define SNAPSHOT_SIZE 65536
#define FIRE_TICS 8
#define BLOCKED_TICS 12
#define WALK_SPEED 10.0
#define WALK_BRAKE 0.2
#define FRICTION_FACTOR (0xe800 / 65536.0)
#define MAX_MOVE 50
// P_UseLines reaches 64 units, and the line is measured from its middle.
#define USE_REACH 44.0

enum
{
    LINE_WALL = 1,
    LINE_DOOR = 2,
    LINE_EXIT = 3,
};

enum
{
    WALK_IDLE,
    WALK_MOVING,
    WALK_ARRIVED,
    WALK_BLOCKED,
};

static char snapshot[SNAPSHOT_SIZE];
static int snapshot_length;
static int snapshot_tic;
static char *line_json;
static int level_count;

static double walk_x, walk_y;
static int walk_state = WALK_IDLE;
static int walk_seq;
static double walk_best;
static int walk_stuck;

static mobj_t *fire_target;
static int fire_tics;
static int shots;

static int use_line = -1;
static int use_tics;
static boolean press_use;

static const char *last_message;
static char message[256];
static int message_seq;

static player_t *Player(void)
{
    return &players[consoleplayer];
}

static void Append(const char *format, ...)
{
    if (snapshot_length >= SNAPSHOT_SIZE - 1)
    {
        return;
    }
    va_list args;
    va_start(args, format);
    const int written = vsnprintf(snapshot + snapshot_length,
                                  SNAPSHOT_SIZE - snapshot_length, format, args);
    va_end(args);
    if (written > 0)
    {
        snapshot_length += written;
        if (snapshot_length > SNAPSHOT_SIZE - 1)
        {
            snapshot_length = SNAPSHOT_SIZE - 1;
        }
    }
}

static int Units(fixed_t value)
{
    return value >> FRACBITS;
}

static int Degrees(angle_t angle)
{
    return (int)(((unsigned long long)angle * 360) >> 32);
}

static boolean IsMobj(const thinker_t *th)
{
    return th->function.p1 == (actionf_p1)P_MobjThinker;
}

static boolean IsMonster(const mobj_t *mo)
{
    return !mo->player
           && ((mo->flags & MF_COUNTKILL) || mo->type == MT_SKULL);
}

static boolean InRange(const mobj_t *player, fixed_t x, fixed_t y)
{
    const int dx = Units(x - player->x), dy = Units(y - player->y);
    return dx >= -RANGE && dx <= RANGE && dy >= -RANGE && dy <= RANGE;
}

static boolean IsDoorSpecial(int special)
{
    switch (special)
    {
        case 1:
        case 26:
        case 27:
        case 28:
        case 31:
        case 32:
        case 33:
        case 34:
        case 117:
        case 118:
            return true;
        default:
            return false;
    }
}

static boolean IsExitSwitch(int special)
{
    return special == 11 || special == 51;
}

// The key a locked door needs: 1 blue, 2 yellow, 3 red, or 0 for none.
static int DoorKey(int special)
{
    switch (special)
    {
        case 26:
        case 32:
            return 1;
        case 27:
        case 34:
            return 2;
        case 28:
        case 33:
            return 3;
        default:
            return 0;
    }
}

static boolean IsLiveMobj(const mobj_t *target)
{
    if (!target)
    {
        return false;
    }
    for (const thinker_t *th = thinkercap.next; th != &thinkercap;
         th = th->next)
    {
        if (th == &target->thinker)
        {
            return IsMobj(th) && target->health > 0;
        }
    }
    return false;
}

static void LineMiddle(const line_t *line, double *x, double *y)
{
    *x = ((double)line->v1->x + line->v2->x) / 2 / FRACUNIT;
    *y = ((double)line->v1->y + line->v2->y) / 2 / FRACUNIT;
}

static void FaceTowards(mobj_t *mo, double x, double y)
{
    mo->angle = R_PointToAngle2(mo->x, mo->y, (fixed_t)(x * FRACUNIT),
                                (fixed_t)(y * FRACUNIT));
}

static int ClampMove(double move)
{
    const int value = (int)lround(move);
    return value > MAX_MOVE ? MAX_MOVE : value < -MAX_MOVE ? -MAX_MOVE : value;
}

// Thrusts towards a point so the player slows down as they reach it, without
// turning. Returns how far away it still is.
static double Steer(ticcmd_t *cmd, const mobj_t *mo, double x, double y)
{
    const double px = (double)mo->x / FRACUNIT, py = (double)mo->y / FRACUNIT;
    const double dx = x - px, dy = y - py;
    const double distance = sqrt(dx * dx + dy * dy);
    if (distance < 0.5)
    {
        return distance;
    }
    double speed = distance * WALK_BRAKE;
    if (speed > WALK_SPEED)
    {
        speed = WALK_SPEED;
    }
    const double vx = (double)mo->momx / FRACUNIT;
    const double vy = (double)mo->momy / FRACUNIT;
    // Momentum loses its friction share after each move, so the thrust has to
    // cover it to reach the wanted speed.
    const double ax = (dx / distance * speed) / FRICTION_FACTOR - vx;
    const double ay = (dy / distance * speed) / FRICTION_FACTOR - vy;
    const double angle = (double)mo->angle * 2 * M_PI / 4294967296.0;
    const double c = cos(angle), s = sin(angle);
    cmd->forwardmove = ClampMove((ax * c + ay * s) * 32);
    cmd->sidemove = ClampMove((ax * s - ay * c) * 32);
    return distance;
}

static void WalkTick(ticcmd_t *cmd, mobj_t *mo)
{
    const double distance = Steer(cmd, mo, walk_x, walk_y);
    const double speed = sqrt((double)mo->momx * mo->momx
                              + (double)mo->momy * mo->momy)
                         / FRACUNIT;
    if (distance < 6 && speed < 1)
    {
        walk_state = WALK_ARRIVED;
        cmd->forwardmove = cmd->sidemove = 0;
        return;
    }
    if (distance < walk_best - 1)
    {
        walk_best = distance;
        walk_stuck = 0;
    }
    else if (++walk_stuck > BLOCKED_TICS)
    {
        walk_state = distance < 24 ? WALK_ARRIVED : WALK_BLOCKED;
        cmd->forwardmove = cmd->sidemove = 0;
    }
}

static void UseTick(ticcmd_t *cmd, mobj_t *mo)
{
    double x, y;
    LineMiddle(&lines[use_line], &x, &y);
    const double dx = x - (double)mo->x / FRACUNIT;
    const double dy = y - (double)mo->y / FRACUNIT;
    if (sqrt(dx * dx + dy * dy) > USE_REACH && use_tics > 0)
    {
        use_tics--;
        Steer(cmd, mo, x, y);
        return;
    }
    FaceTowards(mo, x, y);
    cmd->buttons |= BT_USE;
    use_line = -1;
}

void DOOMGRID_BuildTiccmd(ticcmd_t *cmd)
{
    player_t *player = Player();
    mobj_t *mo = player->mo;
    if (menuactive || paused)
    {
        return;
    }
    // Respawning and leaving the intermission screen both wait for use.
    if (press_use && (gamestate != GS_LEVEL || !mo
                      || player->playerstate == PST_DEAD))
    {
        cmd->buttons |= BT_USE;
        press_use = false;
        return;
    }
    if (gamestate != GS_LEVEL || !mo)
    {
        return;
    }
    if (player->playerstate == PST_DEAD)
    {
        walk_state = WALK_IDLE;
        fire_tics = 0;
        use_line = -1;
        return;
    }
    if (walk_state == WALK_MOVING)
    {
        WalkTick(cmd, mo);
    }
    if (use_line >= 0)
    {
        UseTick(cmd, mo);
    }
    if (fire_tics > 0)
    {
        if (IsLiveMobj(fire_target))
        {
            fire_tics--;
            mo->angle = R_PointToAngle2(mo->x, mo->y, fire_target->x,
                                        fire_target->y);
            cmd->angleturn = 0;
            cmd->ticangleturn = 0;
            cmd->buttons |= BT_ATTACK;
        }
        else
        {
            fire_tics = 0;
            fire_target = NULL;
        }
    }
}

static void Escape(char *out, int size, const char *text)
{
    int at = 0;
    for (; *text && at < size - 2; text++)
    {
        const unsigned char c = (unsigned char)*text;
        if (c == '"' || c == '\\')
        {
            out[at++] = '\\';
            out[at++] = c;
        }
        else if (c >= 32 && c < 127)
        {
            out[at++] = c;
        }
    }
    out[at] = '\0';
}

static void TakeMessage(const player_t *player)
{
    if (player->message && player->message != last_message)
    {
        Escape(message, sizeof(message), player->message);
        message_seq++;
    }
    last_message = player->message;
}

static void WritePlayer(const player_t *player, const mobj_t *mo)
{
    int weapons = 0, keys = 0;
    for (int i = 0; i < NUMWEAPONS; i++)
    {
        weapons |= player->weaponowned[i] ? 1 << i : 0;
    }
    for (int i = 0; i < NUMCARDS; i++)
    {
        keys |= player->cards[i] ? 1 << i : 0;
    }
    Append("\"player\":{\"x\":%d,\"y\":%d,\"angle\":%d,\"health\":%d,"
           "\"armor\":%d,\"weapon\":%d,\"weapons\":%d,\"keys\":%d,"
           "\"dead\":%d,\"ammo\":[",
           Units(mo->x), Units(mo->y), Degrees(mo->angle), player->health,
           player->armorpoints, player->readyweapon, weapons, keys,
           player->playerstate == PST_DEAD);
    for (int i = 0; i < NUMAMMO; i++)
    {
        Append(i ? ",%d" : "%d", player->ammo[i]);
    }
    Append("],\"maxAmmo\":[");
    for (int i = 0; i < NUMAMMO; i++)
    {
        Append(i ? ",%d" : "%d", player->maxammo[i]);
    }
    Append("]}");
}

// Monsters are [id, type, x, y, health, alive, visible] and items are
// [id, type, x, y], where type is the thing's editor number.
static void WriteThings(const mobj_t *player)
{
    int monsters = 0, items = 0;
    Append(",\"monsters\":[");
    for (const thinker_t *th = thinkercap.next;
         th != &thinkercap && monsters < MAX_THINGS; th = th->next)
    {
        if (!IsMobj(th))
        {
            continue;
        }
        mobj_t *mo = (mobj_t *)th;
        if (!IsMonster(mo) || !InRange(player, mo->x, mo->y))
        {
            continue;
        }
        const boolean alive = mo->health > 0 && !(mo->flags & MF_CORPSE);
        Append("%s[%d,%d,%d,%d,%d,%d,%d]", monsters ? "," : "",
               (int)(intptr_t)mo, mo->info->doomednum, Units(mo->x),
               Units(mo->y), mo->health, alive,
               alive && P_CheckSight((mobj_t *)player, mo));
        monsters++;
    }
    Append("],\"items\":[");
    for (const thinker_t *th = thinkercap.next;
         th != &thinkercap && items < MAX_THINGS; th = th->next)
    {
        if (!IsMobj(th))
        {
            continue;
        }
        const mobj_t *mo = (const mobj_t *)th;
        if (!(mo->flags & MF_SPECIAL) || !InRange(player, mo->x, mo->y))
        {
            continue;
        }
        Append("%s[%d,%d,%d,%d]", items ? "," : "", (int)(intptr_t)mo,
               mo->info->doomednum, Units(mo->x), Units(mo->y));
        items++;
    }
    Append("]");
}

// Doors are [line, x, y, open, moving, key, sector], where open is the gap
// under the door sector's ceiling in map units. A door's two faces share a
// sector.
static void WriteDoors(const mobj_t *player)
{
    int doors = 0;
    Append(",\"doors\":[");
    for (int i = 0; i < numlines && doors < MAX_THINGS; i++)
    {
        const line_t *line = &lines[i];
        if (!IsDoorSpecial(line->special) || !line->backsector)
        {
            continue;
        }
        double x, y;
        LineMiddle(line, &x, &y);
        if (!InRange(player, (fixed_t)(x * FRACUNIT), (fixed_t)(y * FRACUNIT)))
        {
            continue;
        }
        const sector_t *door = line->backsector;
        Append("%s[%d,%d,%d,%d,%d,%d,%d]", doors ? "," : "", i, (int)x,
               (int)y, Units(door->ceilingheight - door->floorheight),
               door->ceilingdata != NULL, DoorKey(line->special),
               (int)(door - sectors));
        doors++;
    }
    Append("]");
}

void DOOMGRID_Tick(void)
{
    player_t *player = Player();
    const mobj_t *mo = player->mo;
    if (!mo)
    {
        return;
    }
    TakeMessage(player);
    snapshot_length = 0;
    Append("{\"tic\":%d,\"level\":%d,\"map\":%d,\"episode\":%d,", leveltime,
           level_count, gamemap, gameepisode);
    WritePlayer(player, mo);
    WriteThings(mo);
    WriteDoors(mo);
    Append(",\"walk\":[%d,%d],\"shots\":%d,\"firing\":%d,\"message\":[%d,"
           "\"%s\"],\"kills\":%d,\"totalKills\":%d}",
           walk_seq, walk_state, shots, fire_tics > 0, message_seq, message,
           player->killcount, totalkills);
    snapshot_tic++;
}

// Each line is [x1, y1, x2, y2, kind, index]. Lines a player walks through
// are left out.
static void WriteLines(void)
{
    const int size = numlines * 64 + 16;
    free(line_json);
    line_json = malloc(size);
    int at = snprintf(line_json, size, "[");
    boolean first = true;
    for (int i = 0; i < numlines; i++)
    {
        const line_t *line = &lines[i];
        int kind = 0;
        if (IsDoorSpecial(line->special) && line->backsector)
        {
            kind = LINE_DOOR;
        }
        else if (IsExitSwitch(line->special))
        {
            kind = LINE_EXIT;
        }
        else if (!line->backsector || (line->flags & ML_BLOCKING))
        {
            kind = LINE_WALL;
        }
        else
        {
            const sector_t *front = line->frontsector, *back = line->backsector;
            const fixed_t floor = MAX(front->floorheight, back->floorheight);
            const fixed_t ceiling =
                MIN(front->ceilingheight, back->ceilingheight);
            const fixed_t step = abs(front->floorheight - back->floorheight);
            if (step > 24 * FRACUNIT || ceiling - floor < 56 * FRACUNIT)
            {
                kind = LINE_WALL;
            }
        }
        if (!kind)
        {
            continue;
        }
        at += snprintf(line_json + at, size - at, "%s[%d,%d,%d,%d,%d,%d]",
                       first ? "" : ",", Units(line->v1->x),
                       Units(line->v1->y), Units(line->v2->x),
                       Units(line->v2->y), kind, i);
        first = false;
    }
    snprintf(line_json + at, size - at, "]");
}

void DOOMGRID_LevelStart(void)
{
    level_count++;
    walk_state = WALK_IDLE;
    fire_tics = 0;
    fire_target = NULL;
    use_line = -1;
    last_message = NULL;
    WriteLines();
}

EXPORT int doom_grid_tic(void)
{
    return snapshot_tic;
}

EXPORT const char *doom_grid_snapshot(void)
{
    return snapshot_length > 0 ? snapshot : "null";
}

EXPORT const char *doom_grid_lines(void)
{
    return line_json ? line_json : "[]";
}

EXPORT void doom_grid_walk(int x, int y)
{
    walk_x = x;
    walk_y = y;
    walk_state = WALK_MOVING;
    walk_seq++;
    walk_best = 1e9;
    walk_stuck = 0;
}

EXPORT void doom_grid_stop(void)
{
    walk_state = WALK_IDLE;
}

// 0 idle, 1 walking, 2 arrived, 3 blocked.
EXPORT int doom_grid_walk_state(void)
{
    return walk_state;
}

EXPORT void doom_grid_press_use(void)
{
    press_use = true;
}

// Aims at a monster from the snapshot and holds fire long enough for one shot
// from any weapon. Returns 0 when the monster is gone.
EXPORT int doom_grid_fire(int id)
{
    mobj_t *target = (mobj_t *)(intptr_t)id;
    if (!IsLiveMobj(target))
    {
        return 0;
    }
    fire_target = target;
    fire_tics = FIRE_TICS;
    shots++;
    return 1;
}

// Walks up to a door's line, faces it and presses use. Returns 0 for a line
// that isn't a door or exit switch.
EXPORT int doom_grid_use(int line)
{
    if (line < 0 || line >= numlines
        || !(IsDoorSpecial(lines[line].special)
             || IsExitSwitch(lines[line].special)))
    {
        return 0;
    }
    use_line = line;
    use_tics = 3 * TICRATE;
    return 1;
}

EXPORT void doom_grid_set_speed(int percent)
{
    I_SetTimeScale(percent < 10 ? 10 : percent > 100 ? 100 : percent);
}
