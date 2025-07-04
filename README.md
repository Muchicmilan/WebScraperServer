# Backend Project

## Getting Started

### Prerequisites

- Node.js
- Docker
- npm

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone git@github.com:admin-sync-zone/scraper-backend.git
   cd scraper-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up MongoDB with Docker**
   ```bash
   docker run -d --name my-mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=rootpassword mongo:7
   ```

4. **Create environment file**
   
   Create a `.env` file in the root directory with the following content:
   ```
   MONGO_URI=mongodb://root:rootpassword@localhost:27017/?authMechanism=DEFAULT
   PORT=5001
   ENCRYPTION_KEY=Hke6cvHbgLpJjh1ZGiHg9BUQcHXuHQE0
   ```

5. **Build the project**
   ```bash
   npx tsc
   ```

6. **Run the application**
   
   For development mode:
   ```bash
   npm run start:dev
   ```

The application will be running on `http://localhost:5001`
