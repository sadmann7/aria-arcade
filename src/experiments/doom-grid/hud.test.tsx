// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { Hud } from "./hud";
import { testSnapshot } from "./test-snapshot";

afterEach(cleanup);

it("reads out the status and switches weapons from the toolbar", async () => {
  const user = userEvent.setup();
  const onWeaponChange = vi.fn();
  const snapshot = testSnapshot({ kills: 2, totalKills: 18 });
  render(
    <Hud
      snapshot={{ ...snapshot, player: { ...snapshot.player, keys: 1 } }}
      onWeaponChange={onWeaponChange}
    />,
  );
  const status = screen.getByRole("region", { name: "Status" });
  expect(status.textContent).toContain("Health100%");
  expect(status.textContent).toContain("Kills2/18");
  expect(status.textContent).toContain("Blue passcard");

  screen.getByRole("toolbar", { name: "Weapons" });
  const handgun = screen.getByRole("button", { name: "Handgun" });
  expect(handgun.getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Fist" }));
  expect(onWeaponChange).toHaveBeenCalledWith("1");
});
