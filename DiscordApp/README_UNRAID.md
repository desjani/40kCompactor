# Deploying to Unraid

Since you have an Unraid server, the easiest way to host this bot is to copy the files to your server and use **Docker Compose** to build and run it locally.

## Prerequisites

1.  **SSH Access**: Ensure SSH is enabled on your Unraid server (Settings -> Management Access -> SSH).
2.  **Docker Compose**: Unraid 6.12+ supports Docker Compose natively. If you are on an older version, install the "Docker Compose Manager" plugin from the Apps tab.
3.  **Discord Bot Invite**: Ensure you have invited the bot to your server with the **bot** scope, not just `applications.commands`.
    *   Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    *   Select your application -> **OAuth2** -> **URL Generator**.
    *   Check **bot** AND **applications.commands**.
    *   In **Bot Permissions**, check **Send Messages**, **View Channels**, and **Embed Links**.
    *   Copy the generated URL and use it to invite the bot to your server.

## Step 1: Transfer Files

Copy the entire `40kCompactor` folder from your computer to your Unraid server. You can do this via:
*   **SMB (Network Share)**: Copy it to your `appdata` share (e.g., `\\192.168.50.46\appdata\40kCompactor`).
*   **SCP/SFTP**: Use a tool like FileZilla or WinSCP.

**Important**: Ensure the `.env` file inside `DiscordApp/` is copied over and contains your `DISCORD_TOKEN` and `CLIENT_ID`.

## Step 2: Build and Run

1.  Open a terminal (PowerShell or Command Prompt) and SSH into your Unraid server:
    ```powershell
    ssh root@192.168.50.46
    ```
2.  Navigate to the directory where you copied the files.
    *   If you copied to the `appdata` share, the path is usually `/mnt/user/appdata/40kCompactor`.
    ```bash
    cd /mnt/user/appdata/40kCompactor/DiscordApp
    ```
3.  Run Docker Compose to build and start the container:
    ```bash
    docker compose up -d --build
    ```
    *(Note: Unraid 6.12+ uses `docker compose` with a space. If that fails, try `docker-compose` with a hyphen).*

## Option 2: Manual Docker Commands (If Compose is missing)

If `docker compose` or `docker-compose` commands are not found on your Unraid server, you can build and run the container manually using standard `docker` commands.

1.  **Navigate to the Root Folder**:
    You must run these commands from the **root** `40kCompactor` folder (not inside `DiscordApp`), because the build needs access to the shared `modules` folder.
    ```bash
    cd /mnt/user/appdata/40kCompactor
    ```

2.  **Build the Image**:
    ```bash
    docker build -t 40k-compactor-bot -f DiscordApp/Dockerfile .
    ```
    *(Don't forget the dot `.` at the end!)*

3.  **Run the Container**:
    ```bash
    docker run -d \
      --name 40k-compactor-bot \
      --restart unless-stopped \
      --env-file DiscordApp/.env \
      40k-compactor-bot
    ```

## Step 3: Verify

1.  Check if the container is running:
    ```bash
    docker ps | grep 40k-compactor
    ```
2.  View the logs to ensure it logged in successfully:
    ```bash
    docker logs 40k-compactor-bot
    ```
    You should see: `Ready! Logged in as ...`

## Updating the Bot

If you make changes to the code:
1.  Copy the updated files to the server.
2.  Run the build command again:
    ```bash
    docker compose up -d --build
    ```
