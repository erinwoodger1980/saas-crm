export declare const PRISMA_POSTGRES_PROVIDER = "prisma+postgres";
export declare const PRISMA_POSTGRES_PROTOCOL = "prisma+postgres:";
declare const prismaPostgresBrand: unique symbol;
declare const prismaPostgresDevBrand: unique symbol;
export type PrismaPostgresUrl<T extends string | URL> = T & {
    readonly [prismaPostgresBrand]: true;
};
export type PrismaPostgresDevUrl<T extends string | URL> = PrismaPostgresUrl<T> & {
    readonly [prismaPostgresDevBrand]: true;
};
export declare function isPrismaPostgres<T extends string | URL>(connectionString?: T): connectionString is PrismaPostgresUrl<T>;
export declare function isPrismaPostgresDev<T extends string | URL>(connectionString?: T): connectionString is PrismaPostgresDevUrl<T>;
export {};
