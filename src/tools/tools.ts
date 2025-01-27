import { argv } from "node:process";
import contentTemplateTool from "./ContentTemplate/tool.js";

async function run(args: string[]): Promise<void> {
  let all = false;
  let write = false;

  args.shift();
  args.shift();

  for (let i = args.length - 1; i >= 0; i--) {
    switch (args[i]) {
      case "--write":
        write = true;
        args.splice(i, 1);
        break;
      case "--all":
        all = true;
        args.splice(i, 1);
        break;
    }
  }

  if (args.length == 0) {
    all = true;
  }

  switch (all) {
    case true:
      console.log(await contentTemplateTool(write, 5, 3));
      break;

    case false:
      for (const arg of args) {
        switch (arg) {
          case "ContentTemplate":
            console.log(await contentTemplateTool(write, 5, 7));
            break;
          default:
            console.log(`No tools to run for ${arg}`);
        }
      }
      break;
  }
}

try {
  await run(argv);

  console.log("Finished running all tools.");
  process.exit(0);
} catch (error) {
  console.error("An error occured while running all tools:", error);
  process.exit(1);
}
