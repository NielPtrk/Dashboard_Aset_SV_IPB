import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, IS_PUBLIC_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException("Akses ditolak: autentikasi diperlukan.");
    }

    // Role Admin Sistem is the superuser with full access to all menus & actions
    if (user.role === "Admin Sistem") {
      return true;
    }

    // User whose role was revoked or unassigned
    if (user.role === "Tanpa Role") {
      throw new ForbiddenException("Akses dicabut, hubungi Admin Sistem.");
    }

    // Role Pimpinan: strictly limited to Overview (assets, ruangan, observasi), Help Center (guidelines), personal profile, and logout
    if (user.role === "Pimpinan") {
      const rawPath: string = (req.baseUrl || "") + (req.path || req.url || "");
      const cleanPath = rawPath.split("?")[0];
      const method = req.method;

      const isSelfProfilePatch = method === "PATCH" && cleanPath.endsWith(`/users/${user.id}`);
      const isAuthPost = method === "POST" && (cleanPath.endsWith("/auth/logout") || cleanPath.endsWith("/auth/refresh"));
      const isExportPost = method === "POST" && cleanPath.includes("/assets/export");

      // Deny all write operations except personal profile update, auth logout/refresh, and export
      if (method !== "GET" && !isSelfProfilePatch && !isAuthPost && !isExportPost) {
        throw new ForbiddenException("Role Pimpinan hanya memiliki hak baca (read-only) untuk fitur Overview dan Help Center.");
      }

      // Allowed endpoint paths for Pimpinan
      const isOverviewEndpoint =
        cleanPath.startsWith("/assets") ||
        cleanPath.startsWith("/ruangan") ||
        cleanPath.startsWith("/observasi") ||
        cleanPath.includes("/assets") ||
        cleanPath.includes("/ruangan") ||
        cleanPath.includes("/observasi");

      const isHelpCenterEndpoint = cleanPath.startsWith("/guidelines") || cleanPath.includes("/guidelines");
      const isAuthEndpoint = cleanPath.startsWith("/auth") || cleanPath.includes("/auth");
      const isSelfUserEndpoint = cleanPath.endsWith(`/users/${user.id}`);

      if (!isOverviewEndpoint && !isHelpCenterEndpoint && !isAuthEndpoint && !isSelfUserEndpoint) {
        throw new ForbiddenException("Akses ditolak: role Pimpinan hanya dapat mengakses Overview, Help Center, dan Pengaturan Pribadi.");
      }
    }

    // Role Pekerja Stock Opname is strictly forbidden from deleting any data
    if (user.role === "Pekerja Stock Opname" && req.method === "DELETE") {
      throw new ForbiddenException("Role Pekerja Stock Opname tidak memiliki izin untuk menghapus data.");
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Deny-by-default: if an endpoint has no explicit role decoration, only Admin Sistem can access it
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException("Akses ditolak: endpoint ini hanya dapat diakses oleh Admin Sistem.");
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(`Akses ditolak: role "${user.role}" tidak memiliki izin untuk tindakan ini.`);
    }

    return true;
  }
}
