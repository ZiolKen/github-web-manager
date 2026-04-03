<br>

# <p align="center">Github Web Manager</p>

<div>
  <img style="100%" src="https://capsule-render.vercel.app/api?type=waving&height=100&section=header&reversal=false&fontSize=70&fontColor=FFFFFF&fontAlign=50&fontAlignY=50&stroke=-&descSize=20&descAlign=50&descAlignY=50&theme=cobalt"  />
</div>

<p align="center">
  <a href="https://ziolken.github.io/github-web-manager><img src="https://img.shields.io/badge/github%20pages-121013?style=for-the-badge"></a>
  <a href="https://ziolken.github.io/github-web-manager"><img src="https://img.shields.io/badge/Live-GitHub%20Pages-18181b?style=for-the-badge"></a>
</p>

<p align="center">
  <a href="https://github.com/ZiolKen/github-web-manager/stargazers"><img src="https://img.shields.io/github/stars/ZiolKen/github-web-manager?style=flat"></a>
  <a href="https://github.com/ZiolKen/github-web-manager/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZiolKen/github-web-manager?style=flat"></a>
  <a href="https://github.com/ZiolKen/github-web-manager/forks"><img src="https://img.shields.io/github/forks/ZiolKen/github-web-manager?style=flat"></a>
</p>

GitHub Web Manager is a powerful, client-side toolkit for managing GitHub repositories directly from your browser. It provides a suite of standalone, vanilla JavaScript tools ranging from a comprehensive multi-tab manager to lightweight, single-purpose utilities for common repository operations.

The entire suite is built with pure HTML, CSS, and JavaScript, with no external frameworks, ensuring fast performance and easy modification.

---

## Tools Overview

This repository contains three distinct web-based tools:

### 1. GitHub Manager (`index.html`)

A modern, full-featured Single-Page Application (SPA) for comprehensive repository management.

-   **Session Management**: Connect to your GitHub account using a Personal Access Token (PAT).
-   **Workspace Scoping**: Target a specific a repository and branch for all operations.
-   **Repository Lifecycle**: Create new repositories (public or private) with templates and delete existing ones with safety checks.
-   **Advanced Uploader**: Upload files and folders with a drag-and-drop interface. It leverages the Git Trees API for high-performance, multi-file commits, and includes configurable concurrency.
-   **Efficient Cleaner**: Remove individual files or entire directories. Supports multiple deletion strategies, including the efficient Git Trees API for bulk removal.
-   **Tree Explorer**: Browse the complete file and folder structure of a branch, with prefix filtering and a display limit.
-   **Diagnostics**: A dedicated logging panel shows detailed information about every API request and operation for easy debugging.

### 2. Standalone Uploader (`uploader.html`)

A focused, beautifully designed tool dedicated to uploading files and folders to a GitHub repository.

-   Efficiently handles file and folder uploads (including nested directories) using the Git Trees API.
-   Slick drag-and-drop UI with real-time progress indicators.
-   Supports uploading to a specific branch and base path within the repository.
-   Ideal for workflows that frequently require pushing release artifacts or built assets to GitHub.

### 3. Simple Repo Tool (`repo.html`)

A lightweight, no-frills utility for quickly creating or deleting repositories.

-   Minimalist interface for creating public/private repositories with descriptions and templates.
-   Includes a destructive operation tab for deleting repositories, with a confirmation step to prevent accidents.
-   Perfect for users who need a quick way to perform these two specific actions without the overhead of the full manager.

---

## Usage

Since these are client-side tools, you need to serve them from a web server.

1.  Clone the repository to your local machine:
    ```sh
    git clone https://github.com/ziolken/github-web-manager.git
    ```
2.  Navigate to the project directory:
    ```sh
    cd github-web-manager
    ```
3.  Start a local web server. A simple way is to use Python:
    ```sh
    # For Python 3
    python -m http.server
    ```
4.  Open your browser and navigate to the local server address (e.g., `http://localhost:8000`). You can then access any of the tools:
    -   `http://localhost:8000/index.html` (Full Manager)
    -   `http://localhost:8000/uploader.html` (Standalone Uploader)
    -   `http://localhost:8000/repo.html` (Simple Repo Tool)

---

## Security and Permissions

These tools operate entirely in your browser and communicate directly with the GitHub API. Your token is never sent to any third-party server.

-   **Personal Access Token (PAT)**: You will need to provide a GitHub PAT. It is strongly recommended to use a **Fine-grained Personal Access Token** with the minimum required scopes for the target repository.
-   **Token Storage**: The applications offer an option to "remember" the token, which stores it in your browser's `localStorage`. Avoid using this feature on shared or public computers.

---

### Required Permissions

The necessary permissions depend on the actions you want to perform. The manager UI provides guidance based on the scopes of your provided token.

-   **Read Operations**: `Metadata: read` (for repository details, branches), `Contents: read` (for exploring files).
-   **Write Operations**: `Contents: write` (for uploading, updating, and deleting files).
-   **Admin Operations**: `Administration: write` (for creating and deleting repositories). This corresponds to the `repo` and `delete_repo` scopes in classic tokens.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## ❤️ Credits

Created and maintained by **[ZiolKen](https://github.com/ZiolKen)**.

---

## ☕ Support

If this project helps you:

[![BuyMeACoffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/_zkn) [![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/zkn0461) [![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/ZiolKen) 

---

## ⚠️ Disclaimer

All tools are provided **as-is**.  
Always back up your game files before using automated translation or merge features.

<div>
  <img style="100%" src="https://capsule-render.vercel.app/api?type=waving&height=100&section=footer&reversal=false&fontSize=70&fontColor=FFFFFF&fontAlign=50&fontAlignY=50&stroke=-&descSize=20&descAlign=50&descAlignY=50&theme=cobalt"  />
</div>
