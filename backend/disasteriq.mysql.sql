DROP DATABASE IF EXISTS disasteriq;
CREATE DATABASE disasteriq;
USE disasteriq;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL,
    lat FLOAT DEFAULT 0,
    lng FLOAT DEFAULT 0,
    availability BOOLEAN DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    phone VARCHAR(30),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_id INT,
    incident_type VARCHAR(80) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    people_count INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority_score INT NOT NULL DEFAULT 0,
    priority_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    cluster_boost INT NOT NULL DEFAULT 0,
    severity_support_points INT NOT NULL DEFAULT 0,
    image_url TEXT,
    image_verification_status VARCHAR(30) NOT NULL DEFAULT 'not_submitted',
    image_verification_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE volunteer_skills (
    user_id INT,
    skill_id INT,
    PRIMARY KEY (user_id, skill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE request_skills (
    request_id INT,
    skill_id INT,
    PRIMARY KEY (request_id, skill_id),
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    volunteer_id INT NOT NULL,
    score FLOAT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_acceptance',
    reason TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE support_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    requester_id INT NOT NULL,
    points INT NOT NULL DEFAULT 10,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_support_vote_request_requester (request_id, requester_id),
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
);
