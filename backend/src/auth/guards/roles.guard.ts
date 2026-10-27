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

    // Role Pimpinan is strictly read-only: deny all write operations (POST, PUT, PATCH, DELETE)
    if (user.role === "Pimpinan" && req.method !== "GET") {
      throw new ForbiddenException("Role Pimpinan hanya memiliki hak baca (read-only).");
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
