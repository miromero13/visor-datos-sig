import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Shield,
  Plus,
  Eye,
  X,
  UserCheck,
  UserX,
  Check,
  ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/Presentation/Components/ui/skeleton";
import { Tooltip } from "@/Presentation/Components/ui/tooltip";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import {
  getUsers,
  getRoles,
  createUser,
  updateUser,
  updateUserStatus,
  createRole,
  updateRole,
  type UserItem,
  type RoleItem,
} from "@/Application/Services/users";

export function UsersPage() {
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // Data state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Modal state
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);

  // Form states for Create User
  const [createLogin, setCreateLogin] = useState("");
  const [createNombre, setCreateNombre] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createSelectedRoles, setCreateSelectedRoles] = useState<string[]>([]);
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Form states for Edit User
  const [editNombre, setEditNombre] = useState("");
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([]);
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Form states for Create Role
  const [createRolNombre, setCreateRolNombre] = useState("");
  const [createRolDesc, setCreateRolDesc] = useState("");
  const [createRolError, setCreateRolError] = useState("");
  const [createRolSubmitting, setCreateRolSubmitting] = useState(false);

  // Form states for Edit Role
  const [editRolDesc, setEditRolDesc] = useState("");
  const [editRolEstado, setEditRolEstado] = useState(true);
  const [editRolError, setEditRolError] = useState("");
  const [editRolSubmitting, setEditRolSubmitting] = useState(false);

  // Status toggle loading map
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersData, rolesData] = await Promise.all([getUsers(), getRoles()]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la información.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        u.login.toLowerCase().includes(q) ||
        u.nombre.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.activo) ||
        (statusFilter === "inactive" && !u.activo);

      const matchRole =
        roleFilter === "all" ||
        u.roles.some((r) => r.toLowerCase() === roleFilter.toLowerCase());

      return matchQuery && matchStatus && matchRole;
    });
  }, [users, query, statusFilter, roleFilter]);

  // Filtered Roles
  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        r.nombreRol.toLowerCase().includes(q) ||
        (r.descripcion && r.descripcion.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && r.estado) ||
        (statusFilter === "inactive" && !r.estado);

      return matchQuery && matchStatus;
    });
  }, [roles, query, statusFilter]);

  // Handlers
  const handleToggleUserStatus = async (user: UserItem) => {
    setTogglingStatusId(user.id);
    try {
      await updateUserStatus(user.id, !user.activo);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, activo: !u.activo } : u))
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser((prev) => (prev ? { ...prev, activo: !prev.activo } : null));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setTogglingStatusId(null);
    }
  };

  const openUserDetails = (user: UserItem) => {
    setSelectedUser(user);
    setEditNombre(user.nombre);
    setEditSelectedRoles([...user.roles]);
    setEditError("");
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditSubmitting(true);
    setEditError("");
    try {
      await updateUser(selectedUser.id, {
        nombre: editNombre,
        roles: editSelectedRoles,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, nombre: editNombre, roles: editSelectedRoles }
            : u
        )
      );
      setSelectedUser(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al actualizar usuario.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError("");
    try {
      const created = await createUser({
        login: createLogin,
        nombre: createNombre,
        password: createPassword,
        roles: createSelectedRoles,
      });
      setUsers((prev) => [created, ...prev]);
      setIsCreateUserOpen(false);
      setCreateLogin("");
      setCreateNombre("");
      setCreatePassword("");
      setCreateSelectedRoles([]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error al crear usuario.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openRoleDetails = (role: RoleItem) => {
    setSelectedRole(role);
    setEditRolDesc(role.descripcion || "");
    setEditRolEstado(role.estado);
    setEditRolError("");
  };

  const handleSaveRoleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setEditRolSubmitting(true);
    setEditRolError("");
    try {
      await updateRole(selectedRole.id, {
        descripcion: editRolDesc,
        estado: editRolEstado,
      });
      setRoles((prev) =>
        prev.map((r) =>
          r.id === selectedRole.id
            ? { ...r, descripcion: editRolDesc, estado: editRolEstado }
            : r
        )
      );
      setSelectedRole(null);
    } catch (err) {
      setEditRolError(err instanceof Error ? err.message : "Error al actualizar rol.");
    } finally {
      setEditRolSubmitting(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateRolSubmitting(true);
    setCreateRolError("");
    try {
      const created = await createRole({
        nombreRol: createRolNombre,
        descripcion: createRolDesc,
      });
      setRoles((prev) => [...prev, created]);
      setIsCreateRoleOpen(false);
      setCreateRolNombre("");
      setCreateRolDesc("");
    } catch (err) {
      setCreateRolError(err instanceof Error ? err.message : "Error al crear rol.");
    } finally {
      setCreateRolSubmitting(false);
    }
  };

  const getRoleBadgeStyle = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case "administrador":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "catastro":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "lecturador":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "cortador":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "reconexion":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <AuthenticatedLayout activeItem="Administración">
      <main className="queries-page">
        {/* Header aligned with QueriesPage */}
        <header className="queries-heading flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Administración del Sistema
            </h1>
            <p className="m-0 text-xs text-slate-500">
              Gestioná los operadores, credenciales y perfiles de acceso a la plataforma.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {activeTab === "users" ? (
              <button
                type="button"
                onClick={() => {
                  setIsCreateUserOpen(true);
                  setCreateError("");
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-slate-800 hover:shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-900/30"
              >
                <Plus size={14} className="text-slate-300" />
                <span>Nuevo Usuario</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsCreateRoleOpen(true);
                  setCreateRolError("");
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-slate-800 hover:shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-900/30"
              >
                <Plus size={14} className="text-slate-300" />
                <span>Nuevo Rol</span>
              </button>
            )}
          </div>
        </header>

        {/* Search Panel with Tabs */}
        <section className="search-panel !flex-none" aria-label="Gestión de usuarios y roles">
          {/* Shadcn-like Tab Switcher */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="inline-flex h-9 items-center rounded-lg bg-slate-100 p-1 text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("users");
                  setQuery("");
                  setStatusFilter("all");
                }}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "users"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users size={14} />
                Usuarios ({users.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("roles");
                  setQuery("");
                  setStatusFilter("all");
                }}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "roles"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Shield size={14} />
                Roles ({roles.length})
              </button>
            </div>
          </div>

          {/* Search Controls */}
          <div className="search-controls mt-3">
            <label className="search-query">
              <span>Buscar {activeTab === "users" ? "por login o nombre" : "por nombre o descripción"}</span>
              <input
                className="h-9.5 rounded-lg border border-slate-200 bg-white px-3 text-xs shadow-2xs outline-none transition hover:border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Ingresá texto para buscar ${activeTab === "users" ? "usuarios…" : "roles…"}`}
              />
            </label>

            <label>
              <span>Estado</span>
              <span className="relative block">
                <select
                  className="block h-9.5 w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-xs font-medium text-slate-800 shadow-2xs outline-none transition hover:border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 [&>option]:cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={15}
                  aria-hidden="true"
                />
              </span>
            </label>

            {activeTab === "users" && (
              <label>
                <span>Rol</span>
                <span className="relative block">
                  <select
                    className="block h-9.5 w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-xs font-medium text-slate-800 shadow-2xs outline-none transition hover:border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 [&>option]:cursor-pointer"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">Todos los roles</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.nombreRol}>
                        {r.nombreRol}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={15}
                    aria-hidden="true"
                  />
                </span>
              </label>
            )}
          </div>
        </section>

        {/* Error notification */}
        {error && (
          <p className="map-alert" role="alert">
            {error}
          </p>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div role="status" aria-label="Cargando información" className="flex flex-1 flex-col min-h-0 pt-2">
            <div className="search-table-wrap">
              <table className="search-table">
                <thead>
                  <tr>
                    <th className="col-id">ID</th>
                    <th>{activeTab === "users" ? "Login" : "Nombre Rol"}</th>
                    <th>{activeTab === "users" ? "Nombre Completo" : "Descripción"}</th>
                    <th>{activeTab === "users" ? "Roles" : "Usuarios"}</th>
                    <th className="col-shrink">Estado</th>
                    <th className="col-actions">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map((row) => (
                    <tr key={`skeleton-${row}`}>
                      <td className="col-id">
                        <Skeleton className="h-4 w-12 rounded-sm" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-24 rounded-sm" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-44 rounded-sm" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-32 rounded-sm" />
                      </td>
                      <td className="col-shrink">
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </td>
                      <td className="col-actions">
                        <Skeleton className="ml-auto h-6 w-24 rounded-md" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Content Table */}
        {!loading && !error && (
          <>
            {activeTab === "users" ? (
              filteredUsers.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-sm text-slate-500">No se encontraron usuarios con los criterios actuales.</p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col min-h-0 pt-2">
                  <div className="search-table-wrap">
                    <table className="search-table">
                      <thead>
                        <tr>
                          <th className="col-id">ID</th>
                          <th>Usuario</th>
                          <th>Nombre completo</th>
                          <th>Roles asignados</th>
                          <th className="col-shrink">Estado</th>
                          <th className="col-actions">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr key={user.id} onClick={() => openUserDetails(user)}>
                            <td className="col-id font-mono text-xs text-slate-500">#{user.id}</td>
                            <td className="font-semibold text-slate-800">{user.login}</td>
                            <td className="text-slate-700">{user.nombre}</td>
                            <td>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {user.roles.length > 0 ? (
                                  user.roles.map((r) => (
                                    <span
                                      key={r}
                                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getRoleBadgeStyle(
                                        r
                                      )}`}
                                    >
                                      {r}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Sin roles</span>
                                )}
                              </div>
                            </td>
                            <td className="col-shrink">
                              {user.activo ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  <span className="size-1.5 rounded-full bg-emerald-500" />
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                  <span className="size-1.5 rounded-full bg-slate-400" />
                                  Inactivo
                                </span>
                              )}
                            </td>
                            <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <Tooltip
                                  content={user.activo ? "Desactivar acceso" : "Activar acceso"}
                                  side="top"
                                >
                                  <button
                                    type="button"
                                    disabled={togglingStatusId === user.id}
                                    onClick={() => handleToggleUserStatus(user)}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium shadow-2xs transition-colors ${
                                      user.activo
                                        ? "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    }`}
                                  >
                                    {user.activo ? (
                                      <>
                                        <UserX size={12} />
                                        <span>Desactivar</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck size={12} />
                                        <span>Activar</span>
                                      </>
                                    )}
                                  </button>
                                </Tooltip>
                                <Tooltip content="Ver detalles y editar" side="top">
                                  <button
                                    type="button"
                                    onClick={() => openUserDetails(user)}
                                    className="query-map-link"
                                  >
                                    <Eye size={13} aria-hidden="true" />
                                    Detalles
                                  </button>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex shrink-0 items-center justify-between border-t border-slate-100 pt-3">
                    <p className="m-0 text-xs font-medium text-slate-500">
                      <span className="font-semibold text-slate-900">{filteredUsers.length}</span>{" "}
                      usuarios encontrados
                    </p>
                  </div>
                </div>
              )
            ) : filteredRoles.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-500">No se encontraron roles con los criterios actuales.</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col min-h-0 pt-2">
                <div className="search-table-wrap">
                  <table className="search-table">
                    <thead>
                      <tr>
                        <th className="col-id">ID</th>
                        <th>Nombre Rol</th>
                        <th>Descripción</th>
                        <th className="col-shrink">Usuarios</th>
                        <th className="col-shrink">Estado</th>
                        <th className="col-actions">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoles.map((role) => (
                        <tr key={role.id} onClick={() => openRoleDetails(role)}>
                          <td className="col-id font-mono text-xs text-slate-500">#{role.id}</td>
                          <td className="font-semibold text-slate-800">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getRoleBadgeStyle(
                                role.nombreRol
                              )}`}
                            >
                              {role.nombreRol}
                            </span>
                          </td>
                          <td className="text-slate-600">{role.descripcion || "—"}</td>
                          <td className="col-shrink font-mono text-xs text-slate-600">
                            {role.usuariosCount} {role.usuariosCount === 1 ? "usuario" : "usuarios"}
                          </td>
                          <td className="col-shrink">
                            {role.estado ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                <span className="size-1.5 rounded-full bg-slate-400" />
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <Tooltip content="Ver detalles y editar" side="top">
                                <button
                                  type="button"
                                  onClick={() => openRoleDetails(role)}
                                  className="query-map-link"
                                >
                                  <Eye size={13} aria-hidden="true" />
                                  Detalles
                                </button>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-slate-100 pt-3">
                  <p className="m-0 text-xs font-medium text-slate-500">
                    <span className="font-semibold text-slate-900">{filteredRoles.length}</span>{" "}
                    roles registrados
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* MODAL: Detalles y Edición de Usuario */}
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setSelectedUser(null)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-900">Detalles de Usuario</h3>
                    <p className="m-0 text-xs text-slate-500">ID #{selectedUser.id} · Registrado el {new Date(selectedUser.fechaRegistro).toLocaleDateString("es-AR")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveUserEdit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Login / Usuario</label>
                  <input
                    type="text"
                    disabled
                    value={selectedUser.login}
                    className="mt-1 h-9.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-600 outline-none"
                  />
                  <span className="text-[11px] text-slate-400">El identificador de login no se puede modificar.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="mt-1 h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Roles Asignados</label>
                  <p className="m-0 mb-2 text-[11px] text-slate-500">Seleccioná los roles habilitados para este operador:</p>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((r) => {
                      const isChecked = editSelectedRoles.includes(r.nombreRol);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setEditSelectedRoles(editSelectedRoles.filter((name) => name !== r.nombreRol));
                            } else {
                              setEditSelectedRoles([...editSelectedRoles, r.nombreRol]);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                            isChecked
                              ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-2xs"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {isChecked && <Check size={13} className="text-blue-600" />}
                          {r.nombreRol}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-semibold text-slate-800">Estado de Acceso</span>
                      <span className="text-[11px] text-slate-500">
                        {selectedUser.activo ? "El usuario puede iniciar sesión" : "Acceso bloqueado actualmente"}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={togglingStatusId === selectedUser.id}
                      onClick={() => handleToggleUserStatus(selectedUser)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium shadow-2xs transition-colors ${
                        selectedUser.activo
                          ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {selectedUser.activo ? "Suspender acceso" : "Reactivar acceso"}
                    </button>
                  </div>
                </div>

                {editError && <p className="text-xs text-red-600 font-medium">{editError}</p>}

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editSubmitting ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Nuevo Usuario */}
        {isCreateUserOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setIsCreateUserOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-900">Crear Nuevo Usuario</h3>
                    <p className="m-0 text-xs text-slate-500">Dá de alta un nuevo operador municipal.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Login / Usuario</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. mgarcia"
                    value={createLogin}
                    onChange={(e) => setCreateLogin(e.target.value)}
                    className="mt-1 h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Martín García"
                    value={createNombre}
                    onChange={(e) => setCreateNombre(e.target.value)}
                    className="mt-1 h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Contraseña Inicial</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Contraseña de acceso"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="mt-1 h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Roles</label>
                  <p className="m-0 mb-2 text-[11px] text-slate-500">Seleccioná los roles que tendrá asignados:</p>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((r) => {
                      const isChecked = createSelectedRoles.includes(r.nombreRol);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setCreateSelectedRoles(createSelectedRoles.filter((name) => name !== r.nombreRol));
                            } else {
                              setCreateSelectedRoles([...createSelectedRoles, r.nombreRol]);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                            isChecked
                              ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-2xs"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {isChecked && <Check size={13} className="text-blue-600" />}
                          {r.nombreRol}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {createError && <p className="text-xs text-red-600 font-medium">{createError}</p>}

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateUserOpen(false)}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createSubmitting ? "Creando…" : "Crear Usuario"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Detalles y Edición de Rol */}
        {selectedRole && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setSelectedRole(null)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-900">Detalles de Rol</h3>
                    <p className="m-0 text-xs text-slate-500">ID #{selectedRole.id} · {selectedRole.usuariosCount} usuarios asignados</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveRoleEdit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nombre del Rol</label>
                  <input
                    type="text"
                    disabled
                    value={selectedRole.nombreRol}
                    className="mt-1 h-9.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none"
                  />
                  <span className="text-[11px] text-slate-400">El nombre del rol es identificador único del sistema.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Descripción</label>
                  <textarea
                    rows={3}
                    value={editRolDesc}
                    onChange={(e) => setEditRolDesc(e.target.value)}
                    placeholder="Descripción funcional del rol"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="rol-estado-active"
                    checked={editRolEstado}
                    onChange={(e) => setEditRolEstado(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="rol-estado-active" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Rol activo para asignación
                  </label>
                </div>

                {editRolError && <p className="text-xs text-red-600 font-medium">{editRolError}</p>}

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={editRolSubmitting}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editRolSubmitting ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Nuevo Rol */}
        {isCreateRoleOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setIsCreateRoleOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-900">Crear Nuevo Rol</h3>
                    <p className="m-0 text-xs text-slate-500">Definí un nuevo perfil funcional en el sistema.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateRoleOpen(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateRole} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nombre del Rol</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Inspector"
                    value={createRolNombre}
                    onChange={(e) => setCreateRolNombre(e.target.value)}
                    className="mt-1 h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Descripción</label>
                  <textarea
                    rows={3}
                    placeholder="Describe los alcances o responsabilidades de este rol…"
                    value={createRolDesc}
                    onChange={(e) => setCreateRolDesc(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                  />
                </div>

                {createRolError && <p className="text-xs text-red-600 font-medium">{createRolError}</p>}

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateRoleOpen(false)}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createRolSubmitting}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createRolSubmitting ? "Creando…" : "Crear Rol"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AuthenticatedLayout>
  );
}
