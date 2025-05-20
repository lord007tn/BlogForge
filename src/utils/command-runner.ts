import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";
import { logger } from "./logger";

interface CommandOptions {
	/**
	 * The command to run
	 */
	command: string;

	/**
	 * Command arguments
	 */
	args: string[];

	/**
	 * Whether to show command output
	 */
	silent?: boolean;

	/**
	 * Custom environment variables
	 */
	env?: Record<string, string>;

	/**
	 * Working directory
	 */
	cwd?: string;

	/**
	 * If true, throws error on non-zero exit code
	 */
	throwOnError?: boolean;
}

interface CommandResult {
	/**
	 * Exit code of the command
	 */
	code: number;

	/**
	 * Standard output
	 */
	stdout: string;

	/**
	 * Standard error
	 */
	stderr: string;

	/**
	 * Whether the command succeeded (exit code 0)
	 */
	success: boolean;
}

/**
 * Run a command and return a promise that resolves with the result
 */
export function runCommand(options: CommandOptions): Promise<CommandResult> {
	const {
		command,
		args,
		silent = false,
		env = {},
		cwd,
		throwOnError = false,
	} = options;

	if (!silent) {
		logger.verbose(`Running command: ${command} ${args.join(" ")}`, true);
	}

	return new Promise((resolve, reject) => {
		const spawnOptions: SpawnOptions = {
			stdio: silent ? "pipe" : "inherit",
			shell: true,
			env: { ...process.env, ...env },
			cwd,
		};

		const childProcess = spawn(command, args, spawnOptions);

		let stdout = "";
		let stderr = "";

		if (childProcess.stdout) {
			childProcess.stdout.on("data", (data) => {
				stdout += data.toString();
			});
		}

		if (childProcess.stderr) {
			childProcess.stderr.on("data", (data) => {
				stderr += data.toString();
			});
		}

		childProcess.on("error", (error) => {
			if (throwOnError) {
				reject(error);
			} else {
				resolve({
					code: 1,
					stdout,
					stderr: error.message,
					success: false,
				});
			}
		});

		childProcess.on("close", (code) => {
			const result = {
				code: code ?? 1,
				stdout,
				stderr,
				success: code === 0,
			};

			if (!result.success && throwOnError) {
				reject(new Error(`Command failed with exit code ${code}:\n${stderr}`));
			} else {
				resolve(result);
			}
		});
	});
}

/**
 * Run a BlogForge command in the same context
 */
export async function runBlogForgeCommand(
	group: string,
	command: string,
	args: Record<string, unknown> = {},
): Promise<void> {
	// Get the current node executable
	const nodeExecutable = process.argv[0];
	const scriptPath = process.argv[1];

	// Convert args object to command line arguments
	const argsList: string[] = [];
	for (const [key, value] of Object.entries(args)) {
		if (value === true) {
			argsList.push(`--${key}`);
		} else if (value !== false && value !== undefined && value !== null) {
			argsList.push(`--${key}=${value}`);
		}
	}

	const result = await runCommand({
		command: nodeExecutable,
		args: [scriptPath, group, command, ...argsList],
		env: { BLOG_SMITH_INTERACTIVE: "1" },
	});

	if (!result.success) {
		process.exit(result.code);
	}
}
