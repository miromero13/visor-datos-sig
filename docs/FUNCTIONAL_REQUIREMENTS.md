# Functional Requirements Document

## VisorDatosSIG 2026 Project

**Project:** Responsive Web System for Geographic Data Migration, Administration, and Querying  
**System name:** VisorDatosSIG  
**Course:** Geographic Information Systems  
**Institution:** Universidad Autónoma Gabriel René Moreno – FICCT  
**Source basis:** Technical and functional specifications of the SIG 2026 Integrative Project + summary of the instructor's video about the evolution from AutoCAD to GeoConsulta.  
**Document version:** 1.0  
**Status:** Consolidated functional requirements

---

## 1. Purpose

This document defines the functional requirements of the **VisorDatosSIG** system, consolidating the official project specifications and the functional behavior observed in the reference case presented by the instructor in the video about transforming an AutoCAD-based cadastre into a web geographic information system.

The system shall allow users to:

- migrate geographic information from ESRI Shapefile files to SQL Server;
- validate the integrity, structure, and spatial reference of the data before loading;
- manage users, profiles, and access permissions;
- visualize geographic information through a responsive web viewer;
- query, search, filter, and identify geographic entities;
- synchronize alphanumeric results with their spatial representation;
- maintain traceability of migrations, accesses, and operations;
- publish information through services and GeoJSON responses.

---

## 2. Functional Scope

The system shall consist of the following functional modules:

1. **SHP-SQL Migrator**
2. **Authentication and access control**
3. **Map viewer**
4. **Queries, searches, and filters**
5. **Entity identification and details**
6. **Results panel**
7. **Administration**
8. **Logs and history**
9. **Responsive experience**
10. **Geographic query services**

The mandatory geographic layers are:

- `Manzanas`
- `Lotes`
- `CodigosFijos`
- `Vias`

The official files shall be delivered in Shapefile format and shall use the WGS 84 spatial reference / SRID 4326.

---

## 3. System Actors

### 3.1 Administrator

User with full permissions over query and administration functions.

Main functions:

- log in and log out;
- access the map viewer;
- perform searches and filters;
- view results;
- identify entities;
- export results when applicable;
- manage users;
- manage profiles and permissions;
- view the layer catalog;
- view migration history;
- view the system log;
- change their password.

### 3.2 Consultant

User focused on consuming and querying geographic information.

Main functions:

- log in and log out;
- access the map viewer;
- enable and disable layers;
- perform searches and filters;
- view results;
- identify entities;
- zoom the map to selected entities;
- export results when applicable;
- view their profile;
- change their password.

The Consultant shall not have access to administrative functions, user management, the administrative layer catalog, restricted history, or administrative logs.

---

# 4. Functional Requirements

---

## 4.1 SHP to SQL Server Migration Module

### RF-MIG-001 — Configure SQL Server Connection

The system shall allow configuring a SQL Server connection before starting any migration process.

**Functional criteria:**

- allow entering or selecting the required connection parameters;
- allow testing the connection;
- prevent migration if the connection is invalid;
- display a clear message when the connection fails.

---

### RF-MIG-002 — Select Source Files or Folder

The system shall allow selecting a folder or Shapefile files for processing.

**Functional criteria:**

- accept `.shp` file selection;
- automatically detect the associated `.shx`, `.dbf`, and `.prj` files;
- correctly associate the components belonging to the same layer;
- report when any required component is missing.

---

### RF-MIG-003 — Recognize Official Layers

The migrator shall recognize the official layers:

- `Manzanas`
- `Lotes`
- `CodigosFijos`
- `Vias`

**Functional criteria:**

- identify the layer by name;
- display the detected geometry type;
- display the number of records;
- display the available fields;
- display the spatial extent of the layer.

---

### RF-MIG-004 — Validate Shapefile Integrity

The system shall validate the integrity of each Shapefile dataset before migrating it.

**Minimum validations:**

- existence of `.shp`;
- existence of `.shx`;
- existence of `.dbf`;
- existence of `.prj`;
- ability to read records;
- consistency among files;
- expected geometry type;
- empty geometries;
- invalid geometries;
- text encoding;
- compatibility with the destination table.

The absence of required files shall prevent the load from running.

---

### RF-MIG-005 — Validate Spatial Reference

The system shall read the spatial reference declared in the `.prj` file.

**Functional criteria:**

- verify that the reference corresponds to WGS 84;
- use SRID 4326;
- prevent silent SRID assignment;
- if the `.prj` file is missing or does not correspond to WGS 84, block the migration or require an explicit authorized decision;
- log any incident related to the spatial reference.

---

### RF-MIG-006 — Preview Data Before Migration

The system shall allow users to preview a sample of the data before executing the load.

**Functional criteria:**

- display at least the first 20 records;
- display fields and values;
- display the geometry type;
- display the mapping between source fields and destination fields.

---

### RF-MIG-007 — Map Source Fields to Destination Fields

The system shall perform an explicit mapping between DBF fields and SQL columns.

**Rules:**

- mapping shall not rely only on column position;
- names, types, keys, relationships, and nullability defined by the official physical design shall be respected;
- lengths shall be validated;
- null values shall be validated;
- numeric conversions shall be validated;
- date conversions shall be validated;
- incompatibilities shall be reported before data is inserted.

---

### RF-MIG-008 — Select Migration Mode

The system shall allow selecting a loading mode.

**Minimum modes:**

- safely replace data;
- append data without duplicates.

Append mode shall respect the natural keys or uniqueness rules defined by the official physical design.

---

### RF-MIG-009 — Execute Transactional Load

The migration shall execute within a transaction.

**Functional criteria:**

- process records in batches;
- commit the transaction only when the operation is consistent;
- roll back the transaction in the event of a critical error;
- prevent inconsistent partial loads.

---

### RF-MIG-010 — Store Geometries with SRID 4326

Every migrated geometry shall be persisted using SRID 4326.

**Functional criteria:**

- preserve geographic coordinates correctly;
- validate the geometry before persisting it;
- record any repair performed;
- reject or document non-repairable geometries according to the authorized rule.

---

### RF-MIG-011 — Validate Geometries

The migrator shall validate the geometric integrity of each record.

**Functional criteria:**

- identify invalid geometries;
- identify empty geometries;
- record the affected row;
- record the cause;
- allow repair only through a documented and authorized rule;
- reject the record when repair is not applicable.

---

### RF-MIG-012 — Prevent Duplicates

The system shall prevent duplicate records from being inserted.

**Functional criteria:**

- use the natural key or rule defined in the official physical design;
- detect duplicates during append operations;
- count records skipped due to duplication;
- record the incident in the migration summary.

---

### RF-MIG-013 — Display Migration Progress

The system shall display the current progress of the migration process.

**Minimum information:**

- current layer;
- total records;
- processed records;
- successful records;
- skipped records;
- failed records;
- progress percentage or indicator.

---

### RF-MIG-014 — Cancel Migration

The user shall be able to cancel a migration in progress.

**Functional criteria:**

- stop the operation in a controlled manner;
- roll back the transaction when applicable;
- leave no inconsistent partial data;
- log the cancellation.

---

### RF-MIG-015 — Record Migration Log

The system shall record a log entry for each migration process.

**Minimum data:**

- date and time;
- responsible user;
- processed file;
- layer;
- destination table;
- duration;
- number processed;
- number successful;
- number skipped;
- number failed;
- warnings;
- errors.

---

### RF-MIG-016 — Export Migration Summary

The system shall allow exporting a migration summary.

**Allowed formats:**

- TXT;
- CSV;
- PDF.

This requirement is considered desirable according to the original specification.

---

### RF-MIG-017 — Manage Spatial Indexes

The system may provide an administrative option to create or rebuild spatial indexes for geographic tables.

This requirement is considered desirable and shall be restricted to authorized users.

---

## 4.2 Authentication, Users, and Session

### RF-SEG-001 — Log In

The system shall authenticate users using a username and password.

**Functional criteria:**

- validate credentials;
- deny access with invalid credentials;
- display an invalid-access message;
- create a valid session after successful authentication.

---

### RF-SEG-002 — Manage Profiles

The system shall support at least the following profiles:

- Administrator;
- Consultant.

Each profile shall have permissions defined over modules and operations.

---

### RF-SEG-003 — Restrict Access by Role

The system shall verify permissions on the server.

**Rules:**

- hiding options in the interface shall not be sufficient;
- every protected controller, page, or endpoint shall validate authorization;
- a Consultant shall not access administrative functions.

---

### RF-SEG-004 — Log Out

The user shall be able to securely terminate their session.

**Expected result:**

- invalidate the session;
- redirect to the login screen;
- prevent protected resources from being reused without authentication.

---

### RF-SEG-005 — Expire Session After Inactivity

The session shall expire after an application-defined period of inactivity.

When it expires:

- the user shall be redirected to the login screen;
- only non-sensitive state may be preserved when feasible.

---

### RF-SEG-006 — Record Access Events

The system shall record access events.

**Minimum events:**

- successful login;
- failed login;
- logout;
- relevant administrative operations.

---

### RF-SEG-007 — Manage Users

The Administrator shall be able to manage users.

**Minimum operations:**

- create user;
- edit user;
- activate user;
- block user;
- assign profile;
- reset password.

---

### RF-SEG-008 — Manage Own Password

Every authenticated user shall be able to change their own password.

---

## 4.3 Main Dashboard

### RF-INI-001 — Display System Summary

The system shall provide a main dashboard with summary information.

**Possible information depending on available data:**

- number of elements per layer;
- overall layer status;
- quick actions;
- last update;
- system notices.

---

### RF-INI-002 — Provide Quick Actions

The main dashboard shall provide direct access at least to:

- map viewer;
- queries;
- administrative functions when the user has permission.

---

## 4.4 Map Viewer

### RF-VIS-001 — Display Base Map

The system shall display a free base map compatible with Leaflet and with the terms of the selected provider.

---

### RF-VIS-002 — Display the Four Thematic Layers

The viewer shall represent the following layers:

- Manzanas;
- Lotes;
- CodigosFijos;
- Vias.

---

### RF-VIS-003 — Apply Differentiated Symbology

Each layer shall have differentiated and consistent visual symbology.

**Minimum expected symbology:**

- Manzanas: polygons;
- Lotes: polygons;
- CodigosFijos: points or markers;
- Vias: lines.

Colors and styles shall remain consistent across:

- layer selector;
- legend;
- map;
- related results.

---

### RF-VIS-004 — Enable and Disable Layers

The user shall be able to enable or disable the available layers.

Any combination of visible layers shall remain readable.

---

### RF-VIS-005 — Display Dynamic Legend

The viewer shall display a legend that updates according to the visible layers.

---

### RF-VIS-006 — Navigate the Map

The viewer shall include:

- zoom in;
- zoom out;
- pan;
- zoom to full extent;
- scale;
- pointer or touch coordinates when applicable.

---

### RF-VIS-007 — Fit Map to Layer

The system shall allow fitting the map to the geographic extent of a layer.

---

### RF-VIS-008 — Fit Map to Results

The system shall allow fitting the map to the combined extent of a result set.

---

### RF-VIS-009 — Display Loading State

The viewer shall report:

- data loading;
- recoverable errors;
- temporary failures;
- retry options when applicable.

---

### RF-VIS-010 — Keep Selection Highlighted

When the user selects an entity, it shall remain highlighted until the user:

- selects another entity; or
- clears the selection.

---

### RF-VIS-011 — Preserve Proprietary Layers if the Base Map Fails

When the base-map service is unavailable, the system shall keep its own layers visible whenever technically possible and display a non-intrusive notice.

---

## 4.5 Queries and Searches

### RF-CON-001 — Perform General Search

The system shall allow searches over authorized fields.

**Minimum fields considered by the specification:**

- lot code;
- fixed code;
- block;
- street name;
- other fields defined in the official database.

---

### RF-CON-002 — Allow Partial Search

Text searches shall support partial matches.

**Criteria:**

- be case-insensitive when applicable;
- preserve security;
- preserve performance;
- use only authorized fields.

---

### RF-CON-003 — Search Fixed Codes

The system shall allow locating records associated with fixed codes.

When a result is selected, the system shall:

- locate its geographic representation;
- zoom the map;
- highlight the entity;
- display its available attributes.

---

### RF-CON-004 — Search Lots

The system shall allow searching lots using the fields available in the official physical design.

---

### RF-CON-005 — Search Blocks

The system shall allow searching blocks using the fields available in the official physical design.

---

### RF-CON-006 — Search Streets

The system shall allow searching streets by name or other authorized fields.

---

### RF-CON-007 — Search People When Attributes Are Available

The reference case presented by the instructor allows searching people by surname and geographically locating the related record.

Therefore, **if the official physical design or the delivered data includes attributes such as first name, surname, user, or equivalents**, the system shall allow searching those fields.

This requirement is conditional on the actual existence of those attributes in the official data.

---

## 4.6 Filters

### RF-FIL-001 — Filter by Layer

The user shall be able to select the layer on which the query will be performed.

---

### RF-FIL-002 — Filter by Attributes

The system shall allow applying filters to one or more authorized attributes.

---

### RF-FIL-003 — Combine Filters

When supported by the interface design, the system shall allow combining filter criteria.

The interface may be structured using:

- layer;
- field;
- operator;
- value.

---

### RF-FIL-004 — Clear Filters

The user shall be able to remove all active filters and return to the initial query state.

---

### RF-FIL-005 — Indicate Active Filters

The interface shall display a visible indicator when a query, filter, or selection is active.

---

## 4.7 Entity Identification

### RF-IDN-001 — Identify Entity by Click or Touch

The user shall be able to select an entity directly on the map.

The system shall display the relevant attributes associated with the selected entity.

---

### RF-IDN-002 — Resolve Overlaps Between Layers

When multiple entities from different layers exist under the same selected point, the system shall allow users to:

- choose the desired entity; or
- review the results grouped by layer.

---

### RF-IDN-003 — Display Entity Details

The system shall provide a details panel with the relevant attributes of the selected entity.

Map popups shall remain brief; full details should preferably be displayed in a panel.

---

### RF-IDN-004 — Clear Selection

The user shall have an action to clear the selected entity and remove its highlight.

---

## 4.8 Query Results

### RF-RES-001 — Display Tabular Results

The system shall display search and filter results in a table.

---

### RF-RES-002 — Paginate Results

The results table shall be paginated.

---

### RF-RES-003 — Display Total Results

The system shall display the total number of entities found.

---

### RF-RES-004 — Sort Results

The user shall be able to sort results by allowed fields.

---

### RF-RES-005 — Synchronize Row with Map

When a results row is selected, the system shall:

- locate the corresponding entity;
- zoom the map;
- highlight its geometry.

---

### RF-RES-006 — Synchronize Map with Row

When an entity is selected on the map, the system shall highlight or locate the corresponding row in the results panel when the entity belongs to the current result set.

---

### RF-RES-007 — Handle No-Result Queries

A query with no matches shall be displayed as a normal empty state and not as a technical error.

The user shall be able to modify or clear the filters.

---

### RF-RES-008 — Export Results to CSV

The system may allow exporting filtered alphanumeric results to CSV.

This requirement is desirable according to the original specification.

---

## 4.9 Functionality Derived from the GeoConsulta Case

The following requirements are included because they are part of the behavior shown by the instructor in the reference case. Their implementation depends on the official data containing the required attributes.

### RF-GEO-001 — Relate Geographic and Alphanumeric Information

The system shall allow a geographic entity to have associated queryable alphanumeric attributes.

Conceptual examples derived from the presented case:

- fixed code;
- user;
- location;
- block;
- lot;
- street;
- service status.

Fields that do not exist in the official physical design shall not be invented.

---

### RF-GEO-002 — Locate a Record from an Alphanumeric Search

An alphanumeric search shall be able to lead to its spatial representation.

Expected flow:

1. perform search;
2. display matches;
3. select a result;
4. center or zoom the map;
5. highlight the geometry;
6. display its attributes.

---

### RF-GEO-003 — Display Thematic Symbology Based on Attributes

If the official data contains a status attribute or another thematic classification, the viewer may represent its values using differentiated symbology and a corresponding legend.

The reference video shows service statuses represented with colors. This behavior shall be implemented only if the required attributes are part of the official database or the delivered Shapefiles.

---

### RF-GEO-004 — Display Territorial Context of a Record

When the available data and relationships allow it, the system shall display the territorial context of the selected record, for example:

- block;
- lot;
- street;
- fixed code.

The final relationships shall depend on the official physical design delivered by the instructor.

---

## 4.10 Administration

### RF-ADM-001 — Display Menu According to Profile

Navigation shall be built according to the authenticated user's profile.

Unauthorized options shall not be enabled for the user.

---

### RF-ADM-002 — Manage Profiles and Permissions

The Administrator shall be able to assign access profiles and permissions according to the system rules.

---

### RF-ADM-003 — View Layer Catalog

The Administrator shall be able to view layer information.

**Possible minimum information:**

- layer name;
- metadata;
- styles;
- visible fields;
- searchable fields;
- extent.

---

### RF-ADM-004 — View Migration History

The Administrator shall be able to view the history of performed loads.

**Minimum information:**

- date;
- file;
- table;
- counts;
- duration;
- errors;
- warnings.

---

### RF-ADM-005 — View System Log

The Administrator shall be able to view relevant system events.

**Minimum events:**

- successful logins;
- failed attempts;
- administrative operations;
- migration events.

---

## 4.11 User Profile and Help

### RF-CTA-001 — View Own Profile

Every authenticated user shall be able to view their available personal data.

---

### RF-CTA-002 — Change Password

Every authenticated user shall be able to change their password.

---

### RF-AYU-001 — View User Manual

The system shall provide access to usage instructions for:

- navigating;
- searching;
- filtering;
- interpreting the map;
- using the main functions.

---

### RF-AYU-002 — Display System Information

The system shall provide an “About the System” section with information such as:

- version;
- development team;
- technologies used;
- institutional or contact information when applicable.

---

## 4.12 Responsive Interface

### RF-RSP-001 — Adapt the Interface to Desktop, Tablet, and Mobile

The interface shall keep its main functions operational at different screen sizes.

Minimum reference sizes:

- 360 px;
- 768 px;
- 1366 px.

---

### RF-RSP-002 — Adapt the Side Menu

The side menu shall be:

- collapsible on desktop;
- slide-out, compact, or equivalent on mobile devices.

---

### RF-RSP-003 — Adapt the Results Panel

The results panel shall reorganize on small screens without preventing use of the map.

---

### RF-RSP-004 — Avoid Horizontal Scrolling

At 360 px width, horizontal scrolling shall not be required to use the main functions.

---

### RF-RSP-005 — Keep Touch Controls Usable

Controls shall provide interaction areas suitable for touch use.

---

### RF-RSP-006 — Keep Text Readable

Main text shall be readable without requiring manual screen zoom.

---

### RF-RSP-007 — Keep the Map as the Main Area

Panels, menus, and controls shall not permanently obscure relevant map information.

---

## 4.13 Geographic Query Services

### RF-API-001 — Query Layer Catalog

The system shall expose an operation equivalent to:

`GET /api/capas`

The result may include:

- available layers;
- styles;
- queryable fields;
- extent.

---

### RF-API-002 — Query a Layer in GeoJSON

The system shall expose an operation equivalent to:

`GET /api/capas/{capa}/geojson`

The query shall support allowed parameters such as geographic extent (`bbox`) and filters.

---

### RF-API-003 — Query Entity by Identifier

The system shall expose an operation equivalent to:

`GET /api/capas/{capa}/{id}`

The result shall include the authorized attributes and geometry of the entity.

---

### RF-API-004 — Perform Search Through a Service

The system shall expose an operation equivalent to:

`GET /api/busqueda`

The response shall support pagination and may include the combined geographic extent of the results.

---

### RF-API-005 — Authenticate Through a Service

When required by the architecture, the system shall provide an operation equivalent to:

`POST /api/autenticacion/iniciar`

---

### RF-API-006 — Query Migration History

The system shall provide an operation equivalent to:

`GET /api/migraciones`

This operation shall be restricted to the authorized profile.

---

### RF-API-007 — Return Valid GeoJSON

Map responses shall comply with the standard GeoJSON structure.

**Expected structures:**

- `FeatureCollection`;
- `Feature`;
- `geometry`;
- `properties`.

Coordinates shall follow the order:

`longitude, latitude`

---

### RF-API-008 — Do Not Expose Sensitive Information

System responses shall not include:

- passwords;
- connection strings;
- internal traces;
- secrets;
- unauthorized sensitive data.

---

## 4.14 Functional Error Handling

### RF-ERR-001 — Incomplete Shapefile

If a required component is missing:

- block the load;
- identify the missing file;
- leave the database unchanged.

---

### RF-ERR-002 — Missing or Incompatible PRJ

If the `.prj` file is missing or does not represent WGS 84:

- block the load; or
- request an explicit authorized decision;
- log the incident.

---

### RF-ERR-003 — Invalid Geometry

If a geometry is invalid:

- identify the record;
- report the cause;
- apply repair only when a documented rule exists;
- otherwise reject it.

---

### RF-ERR-004 — DBF-SQL Conversion Error

When a conversion incompatibility occurs:

- identify the field;
- identify the value;
- identify the row;
- roll back the operation when consistency is affected.

---

### RF-ERR-005 — SQL Connection Loss

If the SQL connection is lost during a migration:

- cancel the operation in a controlled manner;
- roll back the transaction;
- inform the user;
- allow retrying.

---

### RF-ERR-006 — Base Map Service Unavailable

The system shall:

- keep proprietary layers available when possible;
- display a notice;
- avoid completely blocking the viewer.

---

### RF-ERR-007 — Expired Session

When the session expires:

- prevent new protected operations;
- request authentication;
- preserve only non-sensitive state when feasible.

---

## 5. Functional Data Rules

### RNF-DAT-001 — Mandatory Use of Official Physical Design

The physical database design delivered by the instructor shall be the official source for:

- table names;
- column names;
- data types;
- primary keys;
- foreign keys;
- nullability;
- constraints;
- relationships.

Structures incompatible with the official design shall not be invented.

---

### RNF-DAT-002 — Source Identifier

Each migrated record shall preserve an identifier that allows it to be traced back to its source record in the Shapefile.

---

### RNF-DAT-003 — Valid Geometry

The database shall not contain invalid geometries except for explicitly justified and documented cases.

---

### RNF-DAT-004 — Consistent SRID

Geometries shall be persisted with SRID 4326.

---

### RNF-DAT-005 — No Duplicates

No duplicates shall exist with respect to the natural keys or official rules defined for each entity.

---

## 6. Functional Navigation Rules

The application shall provide, at minimum, the following navigation options according to permissions:

### Home

- Main dashboard.

### Map Viewer

- General map.
- Layers.
- Tools.

### Queries

- General search.
- Advanced filters.
- Results.

### Administration

Administrator only:

- Users.
- Profiles and permissions.
- Layer catalog.
- Migration history.
- System log.

### Account

- My profile.
- Log out.

### Help

- User manual.
- About the system.

---

## 7. Functional Acceptance Cases

### CA-01 — Migrate the Four Layers

**Acceptance condition:**

- all four layers are processed;
- destination counts match valid records;
- geometries have SRID 4326;
- a log is generated.

---

### CA-02 — Detect Incomplete File

**Acceptance condition:**

- the system detects missing DBF, SHX, or PRJ;
- the database is not modified.

---

### CA-03 — Roll Back on Error

**Acceptance condition:**

- an error during loading causes a rollback;
- no inconsistent partial rows remain.

---

### CA-04 — Display Layers

**Acceptance condition:**

- all four layers can be enabled and disabled;
- each layer has a style;
- the legend reflects the visible layers.

---

### CA-05 — Identify Entity

**Acceptance condition:**

- clicking or tapping an entity displays its correct attributes.

---

### CA-06 — Search and Zoom

**Acceptance condition:**

- the query returns results;
- selecting a result zooms the map to the entity;
- the entity is highlighted.

---

### CA-07 — Apply Combined Filters

**Acceptance condition:**

- the results panel displays only entities that satisfy the criteria;
- the map reflects the same filtered set.

---

### CA-08 — Restrict Administration

**Acceptance condition:**

- a Consultant user cannot access administration or restricted information.

---

### CA-09 — Use on Mobile Device

**Acceptance condition:**

- at 360 px there is no required horizontal scrolling;
- the main functions remain usable.

---

### CA-10 — Query Geometries in a Bounded Way

**Acceptance condition:**

- geometries are obtained using `bbox`, filters, pagination, zoom, or an equivalent strategy;
- the browser does not attempt to render all available information without control.

---

### CA-11 — Install on Another Computer

**Acceptance condition:**

- another computer can install and run the solution by following the manual;
- direct assistance from the development team is not required.

---

### CA-12 — Maintain Traceability

**Acceptance condition:**

- each implemented requirement is linked to its test case;
- verifiable evidence of its operation exists.

---

## 8. Summary Functional Traceability

| Area | Main Requirements | Expected Evidence |
|---|---|---|
| Migration | RF-MIG-001 to RF-MIG-017 | Screenshots, logs, counts, SQL queries |
| Security | RF-SEG-001 to RF-SEG-008 | Access and authorization tests |
| Home | RF-INI-001 to RF-INI-002 | Screenshots and navigation |
| Viewer | RF-VIS-001 to RF-VIS-011 | Screenshots and demonstration |
| Queries | RF-CON-001 to RF-CON-007 | Search results |
| Filters | RF-FIL-001 to RF-FIL-005 | Screenshots and filtered data |
| Identification | RF-IDN-001 to RF-IDN-004 | Selection and details |
| Results | RF-RES-001 to RF-RES-008 | Table, zoom, and synchronization |
| GeoConsulta | RF-GEO-001 to RF-GEO-004 | Search → map flow |
| Administration | RF-ADM-001 to RF-ADM-005 | Role-based access |
| Account and Help | RF-CTA / RF-AYU | Functional screens |
| Responsive | RF-RSP-001 to RF-RSP-007 | Evidence at 360/768/1366 px |
| Services | RF-API-001 to RF-API-008 | HTTP/GeoJSON responses |
| Errors | RF-ERR-001 to RF-ERR-007 | Negative test cases |

---

## 9. Functional Dependencies Not Yet Defined

The following elements cannot be fully defined until the additional official files from the instructor are available:

1. final SQL Server physical design;
2. actual table and column names;
3. natural keys used to prevent duplicates;
4. exact relationships among Manzanas, Lotes, CodigosFijos, and Vias;
5. actual DBF fields;
6. existence of first name, surname, or user data;
7. existence of service-status attributes;
8. exact rules for geometry repair;
9. exact visible, searchable, and exportable fields;
10. cardinalities among entities.

Any implementation related to these points shall be adjusted to the official artifacts when they are delivered.

---

## 10. Functional Exclusions

The following items are outside the minimum scope:

- advanced cartographic geometry editing from the browser;
- native Android or iOS mobile application;
- unrestricted reprojection from reference systems other than those authorized;
- mandatory use of paid commercial map services;
- unauthorized modification of the official physical design;
- mandatory implementation of drinking-water networks;
- mandatory implementation of sewer networks;
- mandatory implementation of valves, pipes, plugs, or connections;
- mandatory implementation of service statuses shown in the video, unless the official data includes those attributes.

---

## 11. Main Functional Flow

```text
SHP/SHX/DBF/PRJ Files
          │
          ▼
Integrity Validation
          │
          ▼
WGS 84 / SRID 4326 Validation
          │
          ▼
Preview and Mapping
          │
          ▼
Transactional Load
          │
          ▼
SQL Server Spatial
          │
          ▼
Query Services
          │
          ▼
JSON / GeoJSON
          │
          ▼
Leaflet Web Viewer
          │
          ├── Layers
          ├── Searches
          ├── Filters
          ├── Identification
          ├── Results
          └── Zoom / Selection
```

---

## 12. Functional Query Flow Inspired by GeoConsulta

```text
User Performs a Search
          │
          ▼
System Queries Authorized Attributes
          │
          ▼
Matches Are Displayed
          │
          ▼
User Selects a Result
          │
          ▼
System Retrieves the Geographic Entity
          │
          ▼
Map Centers or Zooms to the Location
          │
          ▼
Entity Is Highlighted
          │
          ▼
Attributes and Available Context Are Displayed
```

---

## 13. Functional Definition of Done

A functional requirement shall be considered complete when:

- it is implemented;
- it is integrated with related modules;
- it has been tested;
- it meets its acceptance criteria;
- it is documented;
- it has evidence;
- it is versioned in Git;
- it works with the official data;
- it can be demonstrated during delivery.

The fact that it works only on the developer's computer does not constitute acceptance.

---

**End of document**
