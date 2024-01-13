## How to deploy the embassy-api service

Follow these steps to deploy the embassy-api service:

1. Create a folder for the service (e.g., embassy-api).
2. Create a `.env` file with the necessary tokens. You can use the provided `.env.template` as a reference.
3. Add a `sec` folder to the service directory and place the `priv.key` and `pub.key` files from the bot server inside it.
4. Add a `static` folder with mp3 sounds for /play
5. Authenticate yourself on `ghcr.io/hackerembassy` by running the following command:
    ```bash
    echo "PAT_TOKEN_WITH_READ_PACKAGE_PERMISSION" | docker login ghcr.io -u GITHUB_USER_NAME --password-stdin
    ```
    Replace `PAT_TOKEN_WITH_READ_PACKAGE_PERMISSION` with your personal access token that has read package permission, and `GITHUB_USER_NAME` with your GitHub username.
6. Pull the necessary Docker images by running:
    ```bash
    docker compose pull
    ```
7. Start the service in detached mode by running:
    ```bash
    docker compose up -d
    ```
