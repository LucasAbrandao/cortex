import type { ReactNode } from "react";

import { TelemetryProvider } from "../../src/features/telemetry/telemetry-provider";
import "../../src/features/telemetry/telemetry.css";

export default function TelemetryLayout({ children }: { children: ReactNode }) {
  return <TelemetryProvider>{children}</TelemetryProvider>;
}
