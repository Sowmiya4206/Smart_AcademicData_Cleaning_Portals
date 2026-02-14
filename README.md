# Smart Academic Data Cleaning Portal

A multi-page frontend prototype for uploading academic datasets, simulating cleaning/validation workflow, and managing approval flow between user and admin roles.

## Overview

Smart Academic Data Cleaning Portal helps institutions:

- Upload raw academic datasets
- Simulate automated data cleaning progress
- Review cleaned dataset status
- Handle admin approval/rejection flow
- View reports/logs and dataset details

This project is currently **frontend-only** and uses `localStorage` for in-browser data persistence.

## Key Features

- Public landing page with project overview
- User registration and login UI
- Role-based login redirect:
  - Emails containing `admin` redirect to admin pages
  - Other emails redirect to user dashboard
- Dataset upload form with simulated processing state
- Dataset list and dataset details pages
- Admin approval actions:
  - Approve dataset
  - Reject dataset with reason
- Status badges and icons for:
  - Processing
  - Waiting for approval
  - Approved
  - Rejected
- Responsive layout for desktop and mobile

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (no framework)
- Browser `localStorage`

## Project Structure

```text
Smart/
├── index.html
├── about.html
├── signin.html
├── signup.html
├── user-portal.html
├── upload-dataset.html
├── processing.html
├── my-datasets.html
├── dataset-details.html
├── profile.html
├── admin-portal.html
├── dataset-approvals.html
├── manage-users.html
├── reports-logs.html
├── cleaned-result.html
├── cleaned-course-registration.csv
└── assets/
    ├── styles.css
    └── main.js
```
Page Map
index.html: Landing page
about.html: About and workflow explanation
signin.html: Login form
signup.html: Registration form
user-portal.html: User dashboard
upload-dataset.html: Dataset upload form
processing.html: Upload processing/status tracking
my-datasets.html: Dataset list for user
dataset-details.html: Dataset detail view (?id=...)
profile.html: User profile form
admin-portal.html: Admin dashboard
dataset-approvals.html: Admin approval/rejection queue
manage-users.html: User management UI
reports-logs.html: Logs/report view
cleaned-result.html: Approved result summary

Data & State
The app stores datasets under:

localStorage key: smart_portal_datasets
Each dataset item includes:

id
name
uploadedAt
status
uploadedBy
On first load, seed datasets are auto-created if storage is empty.

Getting Started
Clone the repository:

`git clone https://github.com/<your-username>/<your-repo>.git`
`cd <your-repo>`
Open directly in browser:

Open index.html in your browser
Recommended local server (optional):

`python -m http.server 8000`
Then open `http://localhost:8000`

Usage Flow

Register from signup.html
Login from signin.html
Upload dataset from upload-dataset.html
Track status on processing.html or my-datasets.html
Open admin flow via login email containing admin
Approve/reject in dataset-approvals.html
Review result in dataset-details.html / cleaned-result.html

Important Behavior Notes
Login is simulated and not connected to backend authentication.
Admin routing is based on email text containing admin.
File upload is simulated; files are not sent to a server.
Approval/rejection changes are stored in browser localStorage only.
Known Limitations
No backend/API/database
No real authentication/authorization
No real CSV cleaning engine
Data is browser-specific and can be lost by clearing storage
No automated tests included yet
Suggested Next Improvements
Add backend (Node.js/Express or similar) with database support
Implement secure auth (JWT/session + role-based access)
Add real dataset parsing/cleaning pipeline
Replace localStorage with server-side persistence
Add unit/integration/end-to-end tests
Add CI pipeline and deployment workflow

License
This project is currently unlicensed. Add a LICENSE file if you plan to distribute it publicly.
