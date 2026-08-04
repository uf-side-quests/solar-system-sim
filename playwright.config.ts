import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const chromiumArgs = [
  "--enable-unsafe-webgpu",
  ...(process.platform === "linux"
    ? [
        "--use-angle=vulkan",
        "--enable-features=Vulkan",
        "--disable-vulkan-surface",
        "--use-webgpu-adapter=swiftshader",
        "--use-gpu-in-tests",
      ]
    : []),
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Both journeys exercise the same physical GPU; concurrent WebGPU contexts
  // make rendered-pixel assertions contend for device time.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === undefined ? 0 : 2,
  reporter:
    process.env.CI === undefined ? "line" : [["html", { open: "never" }]],
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        launchOptions: { args: chromiumArgs },
      },
    },
  ],
  ...(externalBaseUrl === undefined
    ? {
        webServer: {
          command: "pnpm dev --host 127.0.0.1 --port 4173 --strictPort",
          url: "http://127.0.0.1:4173",
          reuseExistingServer: process.env.CI === undefined,
        },
      }
    : {}),
});
