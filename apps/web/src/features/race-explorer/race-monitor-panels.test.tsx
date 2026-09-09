import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SessionManifestResponse, ReplayResponse } from "@cortex/contracts";
import { raceManifest, raceReplay } from "../../test/race-fixture";
import { TimingTower } from "./race-monitor-panels";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("animates recorded order changes and skips animation for an explicit seek", () => {
  const cancel = vi.fn();
  const animate = vi.fn<HTMLElement["animate"]>(() => ({ cancel } as unknown as Animation));
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const oldAnimate = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = animate;
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
    return this.parentElement ? Array.from(this.parentElement.children).indexOf(this) * 46 : 0;
  });
  const props = { manifest: raceManifest.manifest as unknown as SessionManifestResponse["manifest"], time: 101, focus: "PIA", monitored: ["PIA", "NOR"], onFocus: vi.fn(), onMonitor: vi.fn(), locale: "pt-BR" };
  const before = raceReplay.frames[0]!.standings as unknown as ReplayResponse["frames"][number]["standings"];
  const after = raceReplay.frames[1]!.standings as unknown as ReplayResponse["frames"][number]["standings"];
  try {
    const view = render(<TimingTower {...props} rows={before} animate />);
    view.rerender(<TimingTower {...props} rows={after} animate />);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[0]?.[0]).toEqual([{ transform: "translateY(46px)" }, { transform: "translateY(0)" }]);
    animate.mockClear();
    view.rerender(<TimingTower {...props} rows={before} animate={false} />);
    expect(animate).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  } finally { HTMLElement.prototype.animate = oldAnimate; vi.unstubAllGlobals(); }
});
