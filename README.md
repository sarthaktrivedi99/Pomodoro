# Pomodoro Application

A comprehensive Pomodoro application featuring a client, server, and MCP (Model Context Protocol) server. The project also includes an integrated PostgreSQL database and Casdoor for authentication and user management.

## Project Structure

- `client/`: The frontend application. Runs on port 3000.
- `server/`: The backend server. Runs on port 3001.
- `mcp-server/`: The Model Context Protocol server. Runs on port 3002.
- `docker-compose.yml`: Docker composition to launch all services.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started

Follow these steps to launch the complete application stack locally.

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Pomodoro
   ```

2. **Environment Variables:**
   Ensure you have a `.env` file in the root directory. This is required by the `docker-compose.yml` to supply necessary configuration, such as keys from external services.
   Example keys you might need in `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

3. **Launch the Application:**
   Start all services using Docker Compose:
   ```bash
   docker-compose up --build
   ```
   Or, to run it in the background (detached mode):
   ```bash
   docker-compose up -d --build
   ```

## Services & Ports

Once the application is running, you can access the various services at the following local URLs:

- **Client (Frontend):** [http://localhost:3000](http://localhost:3000)
- **Server (Backend API):** [http://localhost:3001](http://localhost:3001)
- **MCP Server:** [http://localhost:3002](http://localhost:3002)
- **Casdoor (Auth/Admin):** [http://localhost:8000](http://localhost:8000) (Default login: `admin` / `123`)
- **PostgreSQL Database:** Port `5432`

## Shutting Down

To stop the running application, press `Ctrl+C` in the terminal where Docker Compose is running. If you are running in detached mode, use:
```bash
docker-compose down
```

This will gracefully stop and remove the containers, while keeping your data persistent in Docker volumes.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
