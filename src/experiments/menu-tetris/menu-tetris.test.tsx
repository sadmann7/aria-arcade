// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { type Cell, createGame, type Game, HEIGHT, type Kind } from "./game";
import { MenuTetris } from "./menu-tetris";

const said = vi.hoisted(() => [] as string[]);

vi.mock("@ui-sdk/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ui-sdk/core")>()),
  announce: (text: string) => said.push(text),
}));

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true;
  HTMLElement.prototype.showPopover = function () {};
  HTMLElement.prototype.hidePopover = function () {};
  Element.prototype.getAnimations = () => [];
  Element.prototype.scrollIntoView = function () {};
  Element.prototype.checkVisibility = () => true;
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "[popover] { display: block !important }",
    }),
  );
});

afterEach(() => {
  cleanup();
  said.length = 0;
});

const BOTTOM = HEIGHT - 1;

function withPieces(pieces: [number, Kind, [number, number][]][]): Game {
  const game = createGame(1);
  const cells: Cell[] = pieces.flatMap(([pieceId, , points]) =>
    points.map(([row, col], index) => ({
      id: `${pieceId}-${index}`,
      pieceId,
      row,
      col,
    })),
  );
  const kinds = Object.fromEntries(pieces.map(([id, kind]) => [id, kind]));
  return {
    ...game,
    cells,
    kinds,
    nextId: 100,
    next: "T",
    falling: { id: 99, kind: "T", rotation: 0, row: 0, col: 3 },
  };
}

function armedBottom() {
  return withPieces([
    [
      1,
      "I",
      [
        [BOTTOM, 0],
        [BOTTOM, 1],
        [BOTTOM, 2],
        [BOTTOM, 3],
      ],
    ],
    [
      2,
      "I",
      [
        [BOTTOM, 4],
        [BOTTOM, 5],
        [BOTTOM, 6],
        [BOTTOM, 7],
      ],
    ],
    [
      3,
      "O",
      [
        [BOTTOM - 1, 8],
        [BOTTOM - 1, 9],
        [BOTTOM, 8],
        [BOTTOM, 9],
      ],
    ],
  ]);
}

function board() {
  return screen.getByRole("application", { name: "Menu Tetris board" });
}

async function flush() {
  await act(() => settle());
}

async function setup(game: Game) {
  const user = userEvent.setup();
  render(<MenuTetris initialGame={game} seed={1} />);
  await flush();
  act(() => board().focus());
  await flush();
  return user;
}

function focusedCell() {
  return document.activeElement?.getAttribute("aria-label") ?? "";
}

describe("MenuTetris", () => {
  test("landed pieces are named widgets whose items are their cells", async () => {
    await setup(armedBottom());
    const toolbars = screen.getAllByRole("toolbar", { name: "I toolbar" });
    expect(toolbars).toHaveLength(2);
    const first = within(toolbars[0] as HTMLElement).getAllByRole("button");
    expect(first.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Bold, row 1, column 1, armed",
      "Italic, row 1, column 2, armed",
      "Underline, row 1, column 3, armed",
      "Strike, row 1, column 4, armed",
    ]);
    const group = screen.getByRole("group", { name: "O button group" });
    expect(within(group).getAllByRole("button")).toHaveLength(4);
  });

  test("Tab switches to clearing and Escape switches back to steering", async () => {
    const user = await setup(armedBottom());
    expect(board().dataset.mode).toBe("steer");
    expect(screen.getByText("1 armed row. Tab to clear.")).not.toBeNull();

    await user.tab();
    await flush();
    expect(board().dataset.mode).toBe("clear");
    expect(focusedCell()).toBe("Bold, row 1, column 1, visited");
    expect(
      screen.getByText("Clearing. The piece waits. Escape to steer."),
    ).not.toBeNull();

    await user.keyboard("{Escape}");
    await flush();
    expect(document.activeElement).toBe(board());
    expect(board().dataset.mode).toBe("steer");
  });

  test("the clear rows button moves focus into the armed row", async () => {
    const user = await setup(armedBottom());
    await user.click(screen.getByRole("button", { name: "Clear rows" }));
    await flush();
    expect(board().dataset.mode).toBe("clear");
    expect(focusedCell()).toMatch(/row 1, column 1/);
    await user.click(screen.getByRole("button", { name: "Back to steering" }));
    await flush();
    expect(document.activeElement).toBe(board());
  });

  test("arrowing through every cell of an armed row clears it", async () => {
    const user = await setup(armedBottom());

    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await flush();
    expect(focusedCell()).toBe("Underline, row 1, column 3, visited");
    const marked = document.querySelectorAll("[data-visited]");
    expect(marked).toHaveLength(3);

    await user.keyboard("{ArrowRight}");
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await user.tab();
    await flush();
    expect(focusedCell()).toBe("Star, row 2, column 9");
    expect(screen.getAllByRole("toolbar", { name: "I toolbar" })).toHaveLength(
      2,
    );

    await user.keyboard("{ArrowRight}{ArrowRight}");
    await flush();
    expect(focusedCell()).toBe("Flag, row 1, column 9, visited");
    expect(screen.queryByText("1 armed row. Tab to clear.")).toBeNull();

    await user.keyboard("{ArrowRight}");
    await flush();
    expect(screen.queryAllByRole("toolbar", { name: "I toolbar" })).toEqual([]);
    const group = screen.getByRole("group", { name: "O button group" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Star, row 1, column 9", "Heart, row 1, column 10"]);
    expect(
      screen.getByText("Lines", { selector: "dt" }).nextElementSibling
        ?.textContent,
    ).toBe("1");
    expect(document.activeElement).toBe(board());
    expect(board().dataset.mode).toBe("steer");
    expect(said).toContain("Row 1 cleared. Back to steering.");
  });

  test("a visit in a row that isn't full marks nothing", async () => {
    const game = armedBottom();
    const user = await setup({
      ...game,
      cells: game.cells.filter((cell) => cell.id !== "1-0"),
    });
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await flush();
    expect(document.querySelectorAll("[data-visited]")).toHaveLength(0);
    expect(focusedCell()).toBe("Strike, row 1, column 4");
  });

  test("clearing one armed row moves focus to the next one", async () => {
    const user = await setup(
      withPieces([
        [
          1,
          "I",
          [
            [BOTTOM, 0],
            [BOTTOM, 1],
            [BOTTOM, 2],
            [BOTTOM, 3],
          ],
        ],
        [
          2,
          "I",
          [
            [BOTTOM, 4],
            [BOTTOM, 5],
            [BOTTOM, 6],
            [BOTTOM, 7],
          ],
        ],
        [
          3,
          "I",
          [
            [BOTTOM - 3, 8],
            [BOTTOM - 2, 8],
            [BOTTOM - 1, 8],
            [BOTTOM, 8],
          ],
        ],
        [
          4,
          "I",
          [
            [BOTTOM - 3, 9],
            [BOTTOM - 2, 9],
            [BOTTOM - 1, 9],
            [BOTTOM, 9],
          ],
        ],
        [
          5,
          "I",
          [
            [BOTTOM - 1, 0],
            [BOTTOM - 1, 1],
            [BOTTOM - 1, 2],
            [BOTTOM - 1, 3],
          ],
        ],
        [
          6,
          "I",
          [
            [BOTTOM - 1, 4],
            [BOTTOM - 1, 5],
            [BOTTOM - 1, 6],
            [BOTTOM - 1, 7],
          ],
        ],
      ]),
    );
    expect(screen.getByText("2 armed rows. Tab to clear.")).not.toBeNull();

    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await user.tab();
    await user.keyboard("{End}");
    await user.tab();
    await user.keyboard("{End}");
    await flush();

    expect(board().dataset.mode).toBe("clear");
    expect(focusedCell()).toBe("Bold, row 1, column 1, visited");
    expect(said).toContain("Row 1 cleared. 1 armed row left.");
  });

  test("a radio piece keeps its tab stop after its checked cell clears", async () => {
    const user = await setup(
      withPieces([
        [
          1,
          "J",
          [
            [BOTTOM - 1, 0],
            [BOTTOM, 0],
            [BOTTOM, 1],
            [BOTTOM, 2],
          ],
        ],
        [
          2,
          "I",
          [
            [BOTTOM, 3],
            [BOTTOM, 4],
            [BOTTOM, 5],
            [BOTTOM, 6],
          ],
        ],
        [
          3,
          "I",
          [
            [BOTTOM, 7],
            [BOTTOM, 8],
            [BOTTOM, 9],
          ],
        ],
      ]),
    );
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await flush();
    expect(document.activeElement).toBe(board());

    await user.tab();
    await flush();
    expect(focusedCell()).toBe("Yes, row 1, column 1");
  });

  test("a tab list piece adds no hidden tab stops", async () => {
    await setup(
      withPieces([
        [
          1,
          "S",
          [
            [BOTTOM - 1, 1],
            [BOTTOM - 1, 2],
            [BOTTOM, 0],
            [BOTTOM, 1],
          ],
        ],
      ]),
    );
    const panels = document.querySelectorAll("[role=tabpanel]");
    expect(panels.length).toBeGreaterThan(0);
    for (const panel of panels) {
      expect(panel.getAttribute("tabindex")).toBe("-1");
    }
  });

  test("Space drops the falling piece onto the stack as a new widget", async () => {
    const user = await setup(withPieces([]));
    function landed() {
      return [...board().querySelectorAll("[data-cell]")].filter(
        (cell) => !cell.closest("[inert]"),
      );
    }
    expect(landed()).toHaveLength(0);
    await user.keyboard(" ");
    await flush();
    expect(landed()).toHaveLength(4);
    expect(screen.getAllByRole("menubar", { name: "T menubar" })).not.toEqual(
      [],
    );
    expect(document.activeElement).toBe(board());
  });

  test("leaving the game from the pad pauses it, and Resume returns to the board", async () => {
    const user = await setup(withPieces([]));
    const pad = screen.getByRole("button", { name: "Move left" });
    act(() => pad.focus());
    await flush();
    expect(screen.queryByText("Paused")).toBeNull();

    act(() => pad.blur());
    await flush();
    expect(screen.getByText("Paused")).not.toBeNull();

    await user.click(
      screen.getAllByRole("button", { name: "Resume" })[1] as HTMLElement,
    );
    await flush();
    expect(screen.queryByText("Paused")).toBeNull();
    expect(document.activeElement).toBe(board());
  });

  test("the Pause button in the side panel pauses instead of resuming", async () => {
    const user = await setup(withPieces([]));
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await flush();
    expect(screen.getByText("Paused")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Resume" })).toHaveLength(2);
  });

  test("leaving the game from the side panel pauses it", async () => {
    await setup(withPieces([]));
    const pause = screen.getByRole("button", { name: "Pause" });
    act(() => pause.focus());
    await flush();
    expect(screen.queryByText("Paused")).toBeNull();

    act(() => pause.blur());
    await flush();
    expect(screen.getByText("Paused")).not.toBeNull();
  });

  test("the game ends and offers another go", async () => {
    const user = await setup(
      withPieces(
        Array.from({ length: 4 }, (_, index) => [
          index + 1,
          "I",
          [
            [0, 3 + index],
            [1, 3 + index],
          ],
        ]),
      ),
    );
    await user.keyboard(" ");
    await flush();
    expect(screen.getByText("Game over")).not.toBeNull();
    expect(said.some((text) => text.startsWith("Game over."))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Play again" }));
    await flush();
    expect(screen.queryByText("Game over")).toBeNull();
  });
});
