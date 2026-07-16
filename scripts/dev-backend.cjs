const { spawn } = require("child_process");

const child = spawn("npm", ["run", "dev", "--workspace=backend"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: "3002" },
});

child.on("exit", (code) => process.exit(code ?? 0));
