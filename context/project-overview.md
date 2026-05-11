# spi AI

## Overview

spi AI is a real-time collaborative system architecture workspace. Users describe a system in plain English, an AI agent maps that system onto an interactive canvas with nodes and connections, and the app generates a complete technical specification in Markdown. It is designed for developers, architects, and technical teams who want to go from idea to structured system design faster — with AI doing the drafting and humans doing the thinking.

## Goals

1. Let any user describe a system in natural language and get a visual architecture diagram on a shared canvas
2. Enable real-time collaboration — multiple users and AI agents working on the same canvas simultaneously
3. Generate exportable technical specifications from completed system designs
4. Provide AI-powered design critique that flags architectural issues (single points of failure, missing layers, scalability gaps)
5. Support iterative AI refinement — follow-up prompts modify the existing canvas instead of regenerating from scratch
6. Offer smart pattern suggestions (cache layers, load balancers, message queues) contextually as users build
7. Include a template library of common architectures (microservices, serverless, event-driven, monolith) as starting points
8. Ship a polished, production-grade UI that feels like a real product, not a tutorial project

## Core User Flow

1. User lands on the marketing/home page
2. User signs in via Clerk authentication
3. User sees a dashboard with their projects (owned and shared)
4. User creates a new project (blank or from a template)
5. User enters the workspace — a full-screen canvas editor
6. User types a system description in the prompt bar
7. AI agent processes the description and populates the canvas with nodes and connections in real-time
8. User refines the design — manually repositioning nodes, editing labels, or sending follow-up prompts
9. AI critique reviews the design and suggests improvements (optional)
10. User exports the design as a Markdown technical specification
11. User can invite collaborators to work on the canvas together in real-time

## Features

### Canvas and Editor

- Interactive node-based canvas with zoom, pan, and selection
- AI-powered auto-layout for clean node arrangement
- Connection animations showing data flow direction
- Manual node editing — rename, reposition, delete, restyle
- Snap-to-grid and alignment guides
- Mini-map for navigation on complex diagrams

### AI System

- Natural language to architecture diagram generation
- Iterative refinement — follow-up prompts modify existing canvas state
- Design critique — AI reviews architecture and flags issues
- Smart suggestions — contextual recommendations for common patterns
- Background processing via Trigger.dev for long-running AI tasks

### Templates

- Pre-built system design templates (microservices, monolith, serverless, event-driven, API gateway, etc.)
- One-click load onto canvas as a starting point
- Community or curated template library

### Collaboration

- Real-time multi-user canvas via Liveblocks
- Presence indicators (cursors, avatars)
- Shared project access with invite system

### Spec Generation

- Export canvas state as a structured Markdown technical specification
- Includes system overview, component descriptions, data flow, and technology recommendations
- Download or copy to clipboard

### Project Management

- Dashboard with project list (My Projects, Shared With Me)
- Create, rename, delete projects
- Project thumbnails/previews

## Scope

### In Scope

- Authentication and user management (Clerk)
- Project CRUD with ownership
- Real-time collaborative canvas (Liveblocks)
- AI prompt-to-canvas generation (background jobs via Trigger.dev)
- AI design critique and smart suggestions
- Iterative AI refinement of existing canvas
- Pre-built system design templates
- Markdown spec generation and export
- Auto-layout for canvas nodes
- Responsive dashboard (canvas is desktop-focused)
- Deployment on Vercel

### Out of Scope

- Mobile-optimized canvas editor
- Billing, payments, or subscription tiers
- Version history or undo/redo beyond browser session
- Code generation from specs
- Custom node/component creation by end users
- Public sharing or embedding of diagrams
- Offline mode
- Self-hosting support

## Success Criteria

1. A signed-in user can create a new project and land on an empty canvas
2. A user can type a system description and see nodes appear on the canvas in real-time
3. A user can send a follow-up prompt that modifies the existing canvas without wiping it
4. AI critique can analyze a canvas and surface at least one actionable suggestion
5. A user can load a pre-built template onto the canvas
6. Two users can see each other's cursors and changes on the same canvas in real-time
7. A user can export the canvas as a Markdown spec document
8. Auto-layout arranges nodes into a readable diagram with one click
9. The app builds and deploys to Vercel without errors
