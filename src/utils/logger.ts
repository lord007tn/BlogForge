import boxen from "boxen";
import chalk from "chalk";
import figlet from "figlet";
import ora, { type Ora } from "ora";

type LogLevel = "info" | "success" | "warning" | "error" | "debug";
type SpinnerInstance = Ora;

/**
 * Enhanced logger with support for different log levels and formatting
 */
class Logger {
	private spinners: Map<string, SpinnerInstance> = new Map();

	/**
	 * Display a fancy BlogForge header
	 */
	showHeader(text = "BlogForge", color = "cyan"): void {
		const figletText = figlet.textSync(text, {
			font: "Standard",
			horizontalLayout: "default",
			verticalLayout: "default",
		});

		const colorFn = chalk[color as keyof typeof chalk] as (
			text: string,
		) => string;
		process.stdout.write(`\n${colorFn(figletText)}\n`);
	}

	/**
	 * Logs a verbose message only if verbose mode is enabled
	 */
	verbose(message: string, verbose: boolean): void {
		if (verbose) {
			console.log(chalk.gray(`[verbose] ${message}`));
		}
	}

	/**
	 * Logs an informational message
	 */
	info(message: string): void {
		console.log(chalk.blue(`ℹ ${message}`));
	}

	/**
	 * Logs a success message
	 */
	success(message: string): void {
		console.log(chalk.green(`✓ ${message}`));
	}

	/**
	 * Logs a warning message
	 */
	warning(message: string): void {
		console.log(chalk.yellow(`⚠ ${message}`));
	}

	/**
	 * Logs an error message
	 */
	error(message: string): void {
		console.error(chalk.red(`✖ ${message}`));
	}

	/**
	 * Creates a boxed message with the given title and content
	 */
	box(content: string, title?: string, borderColor = "cyan"): string {
		return boxen(content, {
			padding: 1,
			borderColor: borderColor as any,
			borderStyle: "round",
			title,
			titleAlignment: "center",
		});
	}

	/**
	 * Logs a message with the specified log level
	 */
	log(message: string, level: LogLevel = "info"): void {
		switch (level) {
			case "info":
				this.info(message);
				break;
			case "success":
				this.success(message);
				break;
			case "warning":
				this.warning(message);
				break;
			case "error":
				this.error(message);
				break;
			case "debug":
				console.log(chalk.gray(`[debug] ${message}`));
				break;
		}
	}

	/**
	 * Create and start a spinner with the given message
	 */
	spinner(message: string, id = "default"): SpinnerInstance {
		if (this.spinners.has(id)) {
			const spinner = this.spinners.get(id);
			if (!spinner) return ora(message).start();
			spinner.text = message;
			return spinner;
		}

		const spinner = ora(message).start();
		this.spinners.set(id, spinner);
		return spinner;
	}

	/**
	 * Stop a spinner and show a success message
	 */
	spinnerSuccess(message: string, id = "default"): void {
		if (this.spinners.has(id)) {
			const spinner = this.spinners.get(id);
			if (!spinner) {
				this.success(message);
				return;
			}
			spinner.succeed(message);
			this.spinners.delete(id);
		} else {
			this.success(message);
		}
	}

	/**
	 * Stop a spinner and show an error message
	 */
	spinnerError(message: string, id = "default"): void {
		if (this.spinners.has(id)) {
			const spinner = this.spinners.get(id);
			if (!spinner) {
				this.error(message);
				return;
			}
			spinner.fail(message);
			this.spinners.delete(id);
		} else {
			this.error(message);
		}
	}

	/**
	 * Stop a spinner and show a warning message
	 */
	spinnerWarn(message: string, id = "default"): void {
		if (this.spinners.has(id)) {
			const spinner = this.spinners.get(id);
			if (!spinner) {
				this.warning(message);
				return;
			}
			spinner.warn(message);
			this.spinners.delete(id);
		} else {
			this.warning(message);
		}
	}

	/**
	 * Stop a spinner and show an info message
	 */
	spinnerInfo(message: string, id = "default"): void {
		if (this.spinners.has(id)) {
			const spinner = this.spinners.get(id);
			if (!spinner) {
				this.info(message);
				return;
			}
			spinner.info(message);
			this.spinners.delete(id);
		} else {
			this.info(message);
		}
	}

	/**
	 * Stop a spinner
	 */
	spinnerStop(id = "default"): void {
		if (this.spinners.has(id)) {
			const spinner = this.spinners.get(id);
			if (!spinner) return;
			spinner.stop();
			this.spinners.delete(id);
		}
	}
}

// Export a singleton instance
export const logger = new Logger();

/**
 * Legacy log function for backward compatibility
 */
export function log(message: string, verbose: boolean): void {
	logger.verbose(message, verbose);
}
