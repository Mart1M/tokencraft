import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Opens the OS-native "choose folder" dialog on the machine running the
 * server. Only meaningful for a local tool where the server and the browser
 * share the same desktop session.
 */
export async function openNativeFolderDialog(): Promise<string | null> {
  const selected = await pickFolder();
  // macOS in particular returns POSIX paths with a trailing slash (e.g.
  // "/Users/me/project/"); normalize it away so downstream path prefix
  // checks (workspace root containment) don't get a spurious mismatch.
  return selected ? path.resolve(selected) : null;
}

async function pickFolder(): Promise<string | null> {
  if (process.platform === "darwin") {
    return openMacFolderDialog();
  }

  if (process.platform === "win32") {
    return openWindowsFolderDialog();
  }

  return openLinuxFolderDialog();
}

async function openMacFolderDialog(): Promise<string | null> {
  const script = 'POSIX path of (choose folder with prompt "Select a token project")';

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.trim() || null;
  } catch {
    // The user cancelled the dialog, or osascript isn't available.
    return null;
  }
}

async function openWindowsFolderDialog(): Promise<string | null> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      Write-Output $dialog.SelectedPath
    }
  `;

  try {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function openLinuxFolderDialog(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select a token project",
    ]);
    return stdout.trim() || null;
  } catch {
    // Fall through to kdialog below.
  }

  try {
    const { stdout } = await execFileAsync("kdialog", ["--getexistingdirectory"]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
