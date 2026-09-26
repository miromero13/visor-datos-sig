# UI/UX Design Brief

## VisorDatosSIG 2026

**Project:** Responsive Web System for Geographic Data Migration, Administration, and Querying  
**System name:** VisorDatosSIG  
**Design basis:** Technical and functional specifications of the SIG 2026 Integrative Project, especially the navigation appendices and mockups on pages 16 to 22.  
**Version:** 1.0  
**Document objective:** Serve as a UI/UX design guide for building the web interface proposed in the PDF, preserving its functional organization, hierarchy, accessibility, and responsive behavior.

---

# 1. Design Objective

Design a clear, professional, responsive, and task-oriented GIS web interface that allows authenticated users to:

- visualize geographic information;
- enable and disable layers;
- identify elements on the map;
- search alphanumeric information;
- apply filters;
- review results;
- navigate between the map and table;
- manage users and settings when the profile allows it;
- use the system from desktop, tablet, and mobile devices.

The interface shall preserve the **map as the main working element**, preventing panels, tables, or controls from obscuring relevant geographic information.

---

# 2. Design Principles

## 2.1 Functionality Before Decoration

The priority is to facilitate frequent GIS tasks:

- visualize;
- search;
- identify;
- filter;
- select;
- zoom;
- clear;
- export.

Visual elements shall support these actions rather than compete with them.

---

## 2.2 Consistency

The same concepts shall look and behave consistently throughout the application.

Examples:

- same layer name in the selector, legend, map, and results;
- same layer color in every context;
- same button styles for equivalent actions;
- same selection and highlighting rules.

---

## 2.3 Operational Clarity

The user shall know at all times:

- where they are;
- which layer is active;
- which filters are applied;
- which element is selected;
- whether results exist;
- whether the system is loading;
- whether an error occurred;
- how to clear or return to the previous state.

---

## 2.4 Responsive Design

The interface shall work correctly at:

- **360 px**
- **768 px**
- **1366 px**

The design shall reorganize, not simply shrink.

---

## 2.5 Accessibility

The interface shall include:

- visible focus;
- labels associated with forms;
- keyboard navigation in forms;
- readable text;
- sufficient contrast;
- appropriate touch controls;
- information that does not rely exclusively on color.

---

# 3. Target Audience

## 3.1 Administrator

User with full permissions.

Main needs:

- access the viewer;
- query data;
- manage users;
- review migration history;
- view logs;
- access the layer catalog;
- manage profiles and permissions.

---

## 3.2 Consultant

User focused on querying and analysis.

Main needs:

- access the viewer;
- search;
- filter;
- identify elements;
- review results;
- zoom the map;
- export when applicable;
- access their profile.

---

# 4. Information Architecture

The main navigation shall follow the structure proposed in the PDF.

## 4.1 Main Menu

```text
Home

Map Viewer
├── General Map
├── Layers
└── Tools

Queries
├── General Search
├── Advanced Filters
└── Results

Administration
├── Users
├── Profiles and Permissions
├── Layer Catalog
├── Migration History
└── System Log

Account
├── My Profile
└── Log Out

Help
├── User Manual
└── About the System
```

### Rules

- Administration options shall be shown only to the Administrator profile.
- Visible options shall reflect the authenticated user's permissions.
- Actual authorization shall be validated on the server; the UI only represents that authorization.

---

# 5. General Visual Structure

The application shall use a consistent structure across all authenticated screens.

## 5.1 Desktop

```text
┌───────────────────────────────────────────────────────────────┐
│ Header: VisorDatosSIG                      User | Log Out     │
├───────────────┬───────────────────────────────────────────────┤
│               │                                               │
│ Side Menu     │                Main Area                      │
│               │                                               │
│               │                                               │
│               │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

---

## 5.2 Tablet

```text
┌───────────────────────────────────────────────────────────────┐
│ Header                                                        │
├───────────────┬───────────────────────────────────────────────┤
│ Collapsible   │                                               │
│ Menu          │               Main Content                    │
│               │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

---

## 5.3 Mobile

```text
┌──────────────────────────────┐
│ Header        ☰          User│
├──────────────────────────────┤
│                              │
│          Main Content        │
│                              │
│                              │
├──────────────────────────────┤
│ Bottom / Sliding Panel       │
└──────────────────────────────┘
```

### Mobile Rules

- side menu transformed into a drawer;
- result panels converted into a bottom or sliding panel;
- the map shall preserve as much useful space as possible;
- no control shall cause mandatory horizontal scrolling;
- buttons and fields shall be touch-friendly.

---

# 6. Visual Direction

## 6.1 General Style

The PDF proposal uses an aesthetic that is:

- institutional;
- clean;
- technical;
- based on blue tones;
- uses light backgrounds;
- uses soft borders;
- uses simple cards;
- uses readable tables;
- keeps the map as the main visual surface.

The final design may improve colors, iconography, and layout as long as it preserves:

- hierarchy;
- functionality;
- accessibility;
- responsiveness;
- consistency.

---

## 6.2 Conceptual Palette

The PDF does not define a mandatory exact palette.

The proposed approach is:

- **institutional primary color:** blue;
- **backgrounds:** white and very light gray;
- **borders:** neutral gray;
- **primary text:** dark gray;
- **secondary text:** medium gray;
- **success:** green;
- **warning:** yellow/orange;
- **error:** red;
- **information:** blue.

Final colors shall provide sufficient contrast.

---

## 6.3 Typography

Expected characteristics:

- sans-serif;
- high legibility;
- clear hierarchy;
- consistent usage.

Suggested hierarchy:

```text
H1 → Main screen title

H2 → Section

H3 → Subsection

Body → Main content

Small → Metadata, hints, and secondary labels
```

No specific font family is required.

---

# 7. Global Components

## 7.1 Header

Minimum content:

- `VisorDatosSIG` name or text logo;
- user name or profile;
- log-out access.

It shall remain consistent across internal pages.

---

## 7.2 Sidebar

Characteristics:

- main navigation;
- clearly identified active item;
- collapsible on desktop;
- slide-out on mobile;
- options according to profile.

---

## 7.3 Buttons

Buttons shall use action verbs.

Examples defined by the PDF:

- Migrate
- Validate
- Search
- Clear
- Zoom
- Export

Recommended variants:

- Primary
- Secondary
- Outline
- Danger
- Icon button

---

## 7.4 Forms

Characteristics:

- visible label;
- associated control;
- nearby validation message;
- understandable error state;
- visible focus;
- sufficient touch target sizes.

---

## 7.5 Cards

Main use:

- metrics;
- layer summaries;
- quick actions;
- information panels.

---

## 7.6 Tables

Characteristics:

- clear headers;
- pagination;
- sorting;
- row selection;
- essential fields;
- avoid unnecessary technical columns;
- responsive adaptation.

---

## 7.7 Modals

Use only when necessary.

Recommended cases:

- confirmation of irreversible operation;
- confirmation of data replacement;
- sensitive administrative actions.

---

## 7.8 Toast / Alert

Use for:

- completed operation;
- warning;
- recoverable error;
- base map unavailable;
- session close to expiration;
- migration completed.

---

# 8. Required Screens

---

# 8.1 Login Screen

Reference: PDF mockup F.1.

## Objective

Authenticate the user and present the system's institutional identity.

## Desktop Layout

```text
┌───────────────────────────────┬───────────────────────────────┐
│                               │                               │
│      Institutional Area       │          Login Card           │
│                               │                               │
│       VisorDatosSIG           │           Log In              │
│                               │                               │
│      Short Description        │          Username             │
│                               │          Password             │
│                               │          [ Log In ]           │
│                               │                               │
└───────────────────────────────┴───────────────────────────────┘
```

## Elements

- system name;
- institutional description;
- username field;
- password field;
- Log In button;
- invalid-access message.

## States

- empty;
- invalid field;
- authenticating;
- incorrect credentials;
- session started.

## Mobile

The design shall convert to a single-column layout.

---

# 8.2 Main Dashboard

Reference: mockup F.2.

## Objective

Show a quick system summary and frequent actions.

## Main Elements

### Layer Cards

Display, when applicable:

- Manzanas
- Lotes
- Fixed Codes
- Streets

Each card may include:

- name;
- count;
- geometry type or secondary summary.

### Quick Actions

Recommended buttons:

- Open Viewer
- Search Lot
- Query Code

### Additional Information

- last update;
- notices;
- data status.

---

# 8.3 Main Map Viewer

Reference: mockup F.3.

## Objective

Provide the main geographic interaction space.

## Desktop Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
├───────────────┬──────────────────────────────────────────────┤
│ Layers        │ Search...                         [Search]    │
│               │                                              │
│ □ Manzanas    │                                              │
│ □ Lotes       │                 MAP                          │
│ □ Codes       │                                              │
│ □ Streets     │                                              │
│               │                                              │
│ Legend        │                                              │
│               │                                              │
│ Tools         │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

---

## 8.3.1 Layer Selector

Display:

- checkbox or switch;
- layer name;
- symbol or color sample.

Mandatory layers:

- Manzanas;
- Lotes;
- Fixed Codes;
- Streets.

---

## 8.3.2 Legend

The legend shall:

- reflect visible layers;
- preserve the same map colors;
- update dynamically.

---

## 8.3.3 Map Tools

Include:

- zoom +;
- zoom -;
- pan map;
- full extent;
- identify;
- clear selection;
- scale;
- coordinates;
- zoom to results.

---

## 8.3.4 Quick Search

Recommended location:

- top of the map.

Behavior:

```text
Enter Value
      ↓
Search
      ↓
Results
      ↓
Select
      ↓
Zoom + Highlight
```

---

# 8.4 Queries and Filters

Reference: mockup F.4.

## Objective

Allow structured searches over the available information.

## Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Alphanumeric Query                                          │
│                                                             │
│ [Layer ▼] [Field ▼] [Value____________] [Search]            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Results: 32 entities                                        │
│                                                             │
│ Code | Block | Area | Status | Action                       │
│ ---------------------------------------------------------- │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Fields

- Layer
- Field
- Operator when applicable
- Value

---

## Actions

- Search
- Clear
- Export CSV when available

---

## Results

Display:

- total;
- table;
- pagination;
- sorting;
- “View on Map” action.

---

# 8.5 Identification and Details

Reference: mockup F.5.

## Objective

Display information about an entity selected on the map.

## Desktop Layout

```text
┌──────────────────────────────────────────┬───────────────────┐
│                                          │ Entity Details    │
│                                          │                   │
│                  MAP                     │ Layer             │
│                                          │ Code              │
│                [Entity]                  │ Block             │
│                                          │ Area              │
│                                          │ Status            │
│                                          │                   │
│                                          │ [Zoom]            │
│                                          │ [Clear]           │
└──────────────────────────────────────────┴───────────────────┘
```

---

## Behavior

When selecting a geometry:

1. highlight entity;
2. keep selection active;
3. open details panel;
4. display relevant attributes;
5. allow Zoom;
6. allow Clear.

---

## Multiple Matches

When several entities exist under the same point:

- display selector;
- group results by layer;
- allow choosing an entity.

---

# 8.6 User Administration

Reference: mockup F.6.

## Objective

Manage users and profiles.

## Access

Administrator only.

## Layout

```text
Users and Profiles                          [New User]

Name | Username | Profile | Status | Actions
------------------------------------------------
...                                       Edit
                                          Block
```

---

## Functions

- create user;
- edit;
- activate;
- block;
- reset password;
- assign profile.

---

## Visual States

Examples:

- Active
- Inactive
- Blocked

Status shall not be communicated by color alone.

---

# 8.7 Responsive Mobile View

Reference: mockup F.7.

## Objective

Preserve the viewer's main functions at a minimum width of 360 px.

## Suggested Layout

```text
┌──────────────────────────────┐
│ ☰ VisorDatosSIG         ⋮    │
├──────────────────────────────┤
│ [Search___________________]  │
├──────────────────────────────┤
│                              │
│                              │
│             MAP              │
│                              │
│                              │
├──────────────────────────────┤
│ Layers and Results           │
│ Bottom Panel                 │
│                              │
│ [View Results]               │
└──────────────────────────────┘
```

---

## Rules

- main menu in a drawer;
- map as the predominant area;
- side panel transformed into a bottom sheet or drawer;
- tables adapted or converted into cards when necessary;
- floating controls shall not cover relevant content;
- do not use hover as the only interaction;
- tapping an entity shall be equivalent to clicking on desktop.

---

# 9. Map Design

## 9.1 Layer Hierarchy

The four layers shall be clearly distinguishable:

```text
Manzanas
Lotes
Fixed Codes
Streets
```

---

## 9.2 Base Symbology

The specification proposes:

- polygons with transparent fill;
- points as markers;
- streets as lines.

Styles shall allow overlapping layers to remain distinguishable.

---

## 9.3 Selection

A selected entity shall use a clearly distinct highlight style.

Conceptual examples:

- thicker border;
- emphasis color;
- halo;
- selected icon.

Do not rely on color alone.

---

## 9.4 Zoom

The system shall support:

- manual zoom;
- zoom to full extent;
- zoom to layer;
- zoom to results;
- zoom to entity.

---

## 9.5 Map States

### Loading

Display a discreet indicator.

### No Visible Data

Display an informative state.

### Recoverable Error

Display a message and Retry option.

### Base Map Unavailable

Keep proprietary layers visible when possible and display a notice.

---

# 10. Search Design

## 10.1 Simple Search

Use a prominent field for quick queries.

Examples allowed by the requirements:

- lot code;
- fixed code;
- block;
- street name;
- other authorized fields.

---

## 10.2 Advanced Search

Use the structure:

```text
Layer
Field
Operator
Value
```

---

## 10.3 Selected Result

When a result is selected:

```text
Selected Row
      ↓
Map Centers
      ↓
Geometry Highlighted
      ↓
Details Panel
```

---

# 11. Results Design

## 11.1 Desktop

Prefer a table.

Characteristics:

- paginated;
- sortable;
- clear headers;
- visible selection;
- “View on Map” action.

---

## 11.2 Mobile

Valid options:

- table with priority columns;
- cards;
- compact list.

Never force a full desktop table if it causes excessive horizontal scrolling.

---

## 11.3 No Results

Display:

- neutral icon or indicator;
- “No results” message;
- suggestion to modify filters;
- Clear Filters button when applicable.

Do not treat this situation as an error.

---

# 12. States and Feedback

Every important operation shall provide feedback.

## 12.1 Global States

- Default
- Hover
- Focus
- Active
- Selected
- Disabled
- Loading
- Success
- Warning
- Error

---

## 12.2 Loading

Use:

- spinner;
- skeleton;
- progress bar;
- contextual text.

Examples:

- Loading layers...
- Searching...
- Processing...
- Updating results...

---

## 12.3 Error

Messages shall:

- state what happened;
- avoid internal technical details;
- suggest an action when possible.

---

# 13. Migrator Design

Although the PDF mockups focus mainly on the web application, the migrator's visual experience shall follow the same principles of clarity and consistency.

## 13.1 Recommended Flow

```text
1. SQL Connection
2. File Selection
3. Validation
4. Preview
5. Mapping
6. Load Configuration
7. Migration
8. Summary
```

---

## 13.2 Selection Screen

Elements:

- folder or file;
- detected associated files;
- recognized layer;
- validation status.

---

## 13.3 Preview Screen

Display:

- first 20 records;
- fields;
- geometry;
- source → destination mapping.

---

## 13.4 Progress Screen

Display:

```text
Current Layer

████████████████░░░ 82%

Processed: 4,820

Successful: 4,800

Skipped: 15

Failed: 5

[Cancel]
```

---

## 13.5 Migration Result

Display:

- success / failure;
- duration;
- processed records;
- warnings;
- errors;
- action to export summary when available.

---

# 14. UI Accessibility

## Mandatory

- labels associated with inputs;
- visible focus;
- keyboard navigation;
- states not communicated by color alone;
- sufficient contrast;
- buttons with clear names;
- readable text;
- appropriate touch controls.

---

# 15. Content Rules

## 15.1 Language

The entire interface shall be presented in Spanish.

---

## 15.2 Terminology

Use consistent GIS terminology.

Examples:

- Layer
- Geometry
- Extent
- Identify
- Zoom
- Results
- Filters
- Coordinates
- Legend

---

## 15.3 Buttons

Prefer verbs.

Correct:

```text
Search
Clear
Zoom
Export
Migrate
Validate
Save
Cancel
```

Avoid ambiguous labels.

---

# 16. UI Components to Design

The design system shall include at least:

```text
AppHeader

Sidebar

MobileDrawer

PageHeader

Optional Breadcrumb

Button

IconButton

Input

PasswordInput

Select

Checkbox

Switch

SearchInput

Card

StatCard

Alert

Toast

Badge

DataTable

Pagination

LayerItem

LayerSwitcher

MapLegend

MapToolbar

MapPopup

MapDetailPanel

FilterBar

FilterChip

ResultRow

ResultCard

Drawer

BottomSheet

Modal

LoadingSpinner

ProgressBar

Skeleton

EmptyState

ErrorState
```

---

# 17. Functional Breakpoints

## Mobile

`360 px – 767 px`

- drawer;
- single column;
- bottom sheet;
- touch controls;
- map-dominant layout.

## Tablet

`768 px – 1023 px`

- compact sidebar;
- partially collapsible panels;
- simplified table.

## Desktop

`1024 px+`

- fixed or collapsible sidebar;
- map and panels simultaneously visible;
- full tables.

The PDF evaluation reference specifically includes 360, 768, and 1366 px.

---

# 18. Priority Design Flows

## Flow 1 — Login

```text
Login

→ Validate

→ Main Dashboard
```

---

## Flow 2 — Open Viewer

```text
Home

→ Open Viewer

→ Load Map

→ Display Layers
```

---

## Flow 3 — Search Entity

```text
Viewer

→ Enter Search

→ Results

→ Select

→ Zoom

→ Highlight

→ Show Details
```

---

## Flow 4 — Apply Filters

```text
Queries

→ Choose Layer

→ Choose Field

→ Enter Value

→ Search

→ Table

→ View on Map
```

---

## Flow 5 — Direct Identification

```text
Map

→ Click/Tap

→ Identify Entity

→ Details Panel

→ Zoom / Clear
```

---

## Flow 6 — Manage User

```text
Administration

→ Users

→ New / Edit

→ Save

→ Confirmation
```

---

# 19. Recommended Design Deliverables

## 19.1 Wireframes

Minimum screens:

- Login
- Main Dashboard
- Map Viewer
- Queries
- Identification and Details
- User Administration
- Mobile Viewer

---

## 19.2 High-Fidelity UI

Design for:

- desktop 1366 px;
- tablet 768 px;
- mobile 360 px.

---

## 19.3 Component Library

Create reusable components with states:

- default;
- hover;
- focus;
- selected;
- disabled;
- loading;
- error.

---

## 19.4 Clickable Prototype

The prototype shall demonstrate at least:

```text
Login

→ Home

→ Viewer

→ Search

→ Result

→ Zoom

→ Details
```

and:

```text
Administrator

→ Users

→ Edit User
```

---

# 20. Design Acceptance Criteria

The UI design shall be considered aligned with the specification when it:

- preserves the hierarchy proposed in the mockups;
- includes the functional screens from Appendix F;
- preserves map, layers, search, and identification as core functions;
- respects roles and menu options;
- is usable at 360, 768, and 1366 px;
- does not generate mandatory horizontal scrolling on mobile;
- keeps the map as the main area;
- visually synchronizes selection between map and results;
- includes loading, error, and no-result states;
- keeps layer colors and names consistent;
- provides touch controls;
- uses accessible labels;
- provides visible focus;
- does not rely exclusively on color to communicate state.

---

# 21. Design Constraints

The design shall not:

- replace map functionality with a purely tabular interface;
- permanently obscure the map with panels;
- display administrative options to the Consultant;
- rely on hover for essential functions;
- use color as the only indicator of selection or error;
- force mobile users to use horizontal scrolling for main functions;
- overcrowd the map with overlapping controls;
- display unnecessary technical fields in tables;
- use lengthy popups when a details panel exists.

---

# 22. Functional Reference of the PDF Mockups

## F.1 — Login

Objective:

authentication and institutional identity.

## F.2 — Main Dashboard

Objective:

layer summary and quick actions.

## F.3 — Map Viewer

Objective:

map, layers, legend, search, and navigation.

## F.4 — Queries and Filters

Objective:

alphanumeric query and paginated results.

## F.5 — Identification and Details

Objective:

spatial selection and attributes.

## F.6 — User Administration

Objective:

user and profile management.

## F.7 — Mobile

Objective:

maintain the GIS workflow on a small screen.

---

# 23. Expected Result

The final product shall feel like a modern institutional GIS application focused on querying and operation.

The main hierarchy shall be:

```text
MAP

  ↓

Layers

  ↓

Search / Filters

  ↓

Results

  ↓

Details
```

and not:

```text
Dashboard

  ↓

Tables

  ↓

Secondary Map
```

The map is the system's core functional area.

---

**End of Design Brief**
