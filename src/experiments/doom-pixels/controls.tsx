const controls = [
  { keys: "↑ ↓ or W S", action: "Move" },
  { keys: "← →", action: "Turn" },
  { keys: "A D", action: "Strafe" },
  { keys: "F or Ctrl", action: "Fire" },
  { keys: "E or Space", action: "Use" },
  { keys: "1–7", action: "Weapons" },
  { keys: "Shift", action: "Run" },
  { keys: "M", action: "Map" },
  { keys: "Esc", action: "Menu" },
  { keys: "P", action: "Pause and inspect pixels" },
  { keys: "Tab", action: "Leave the screen" },
];

export function Controls() {
  return (
    <dl aria-label="Keys" className="flex flex-wrap gap-x-4 gap-y-1">
      {controls.map(({ keys, action }) => (
        <div key={action} className="flex gap-1.5">
          <dt>
            <kbd className="font-mono text-foreground">{keys}</kbd>
          </dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  );
}
