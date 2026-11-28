#ifndef DOOM_GRID_H
#define DOOM_GRID_H

struct ticcmd_s;

void DOOMGRID_LevelStart(void);
void DOOMGRID_Tick(void);
void DOOMGRID_BuildTiccmd(struct ticcmd_s *cmd);

#endif
