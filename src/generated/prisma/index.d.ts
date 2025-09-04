
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Language
 * 
 */
export type Language = $Result.DefaultSelection<Prisma.$LanguagePayload>
/**
 * Model State
 * 
 */
export type State = $Result.DefaultSelection<Prisma.$StatePayload>
/**
 * Model Role
 * 
 */
export type Role = $Result.DefaultSelection<Prisma.$RolePayload>
/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Category
 * 
 */
export type Category = $Result.DefaultSelection<Prisma.$CategoryPayload>
/**
 * Model CategoryTranslation
 * 
 */
export type CategoryTranslation = $Result.DefaultSelection<Prisma.$CategoryTranslationPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const RoleName: {
  SUPER_ADMIN: 'SUPER_ADMIN',
  LANGUAGE_ADMIN: 'LANGUAGE_ADMIN',
  NEWS_DESK: 'NEWS_DESK',
  CITIZEN_REPORTER: 'CITIZEN_REPORTER',
  GUEST: 'GUEST'
};

export type RoleName = (typeof RoleName)[keyof typeof RoleName]

}

export type RoleName = $Enums.RoleName

export const RoleName: typeof $Enums.RoleName

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Languages
 * const languages = await prisma.language.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Languages
   * const languages = await prisma.language.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.language`: Exposes CRUD operations for the **Language** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Languages
    * const languages = await prisma.language.findMany()
    * ```
    */
  get language(): Prisma.LanguageDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.state`: Exposes CRUD operations for the **State** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more States
    * const states = await prisma.state.findMany()
    * ```
    */
  get state(): Prisma.StateDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.role`: Exposes CRUD operations for the **Role** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Roles
    * const roles = await prisma.role.findMany()
    * ```
    */
  get role(): Prisma.RoleDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.category`: Exposes CRUD operations for the **Category** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Categories
    * const categories = await prisma.category.findMany()
    * ```
    */
  get category(): Prisma.CategoryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.categoryTranslation`: Exposes CRUD operations for the **CategoryTranslation** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CategoryTranslations
    * const categoryTranslations = await prisma.categoryTranslation.findMany()
    * ```
    */
  get categoryTranslation(): Prisma.CategoryTranslationDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.15.0
   * Query Engine version: 85179d7826409ee107a6ba334b5e305ae3fba9fb
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Language: 'Language',
    State: 'State',
    Role: 'Role',
    User: 'User',
    Category: 'Category',
    CategoryTranslation: 'CategoryTranslation'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "language" | "state" | "role" | "user" | "category" | "categoryTranslation"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Language: {
        payload: Prisma.$LanguagePayload<ExtArgs>
        fields: Prisma.LanguageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.LanguageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.LanguageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>
          }
          findFirst: {
            args: Prisma.LanguageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.LanguageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>
          }
          findMany: {
            args: Prisma.LanguageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>[]
          }
          create: {
            args: Prisma.LanguageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>
          }
          createMany: {
            args: Prisma.LanguageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.LanguageCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>[]
          }
          delete: {
            args: Prisma.LanguageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>
          }
          update: {
            args: Prisma.LanguageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>
          }
          deleteMany: {
            args: Prisma.LanguageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.LanguageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.LanguageUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>[]
          }
          upsert: {
            args: Prisma.LanguageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LanguagePayload>
          }
          aggregate: {
            args: Prisma.LanguageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateLanguage>
          }
          groupBy: {
            args: Prisma.LanguageGroupByArgs<ExtArgs>
            result: $Utils.Optional<LanguageGroupByOutputType>[]
          }
          count: {
            args: Prisma.LanguageCountArgs<ExtArgs>
            result: $Utils.Optional<LanguageCountAggregateOutputType> | number
          }
        }
      }
      State: {
        payload: Prisma.$StatePayload<ExtArgs>
        fields: Prisma.StateFieldRefs
        operations: {
          findUnique: {
            args: Prisma.StateFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.StateFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>
          }
          findFirst: {
            args: Prisma.StateFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.StateFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>
          }
          findMany: {
            args: Prisma.StateFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>[]
          }
          create: {
            args: Prisma.StateCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>
          }
          createMany: {
            args: Prisma.StateCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.StateCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>[]
          }
          delete: {
            args: Prisma.StateDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>
          }
          update: {
            args: Prisma.StateUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>
          }
          deleteMany: {
            args: Prisma.StateDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.StateUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.StateUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>[]
          }
          upsert: {
            args: Prisma.StateUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StatePayload>
          }
          aggregate: {
            args: Prisma.StateAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateState>
          }
          groupBy: {
            args: Prisma.StateGroupByArgs<ExtArgs>
            result: $Utils.Optional<StateGroupByOutputType>[]
          }
          count: {
            args: Prisma.StateCountArgs<ExtArgs>
            result: $Utils.Optional<StateCountAggregateOutputType> | number
          }
        }
      }
      Role: {
        payload: Prisma.$RolePayload<ExtArgs>
        fields: Prisma.RoleFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RoleFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RoleFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>
          }
          findFirst: {
            args: Prisma.RoleFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RoleFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>
          }
          findMany: {
            args: Prisma.RoleFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>[]
          }
          create: {
            args: Prisma.RoleCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>
          }
          createMany: {
            args: Prisma.RoleCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RoleCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>[]
          }
          delete: {
            args: Prisma.RoleDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>
          }
          update: {
            args: Prisma.RoleUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>
          }
          deleteMany: {
            args: Prisma.RoleDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RoleUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.RoleUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>[]
          }
          upsert: {
            args: Prisma.RoleUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RolePayload>
          }
          aggregate: {
            args: Prisma.RoleAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRole>
          }
          groupBy: {
            args: Prisma.RoleGroupByArgs<ExtArgs>
            result: $Utils.Optional<RoleGroupByOutputType>[]
          }
          count: {
            args: Prisma.RoleCountArgs<ExtArgs>
            result: $Utils.Optional<RoleCountAggregateOutputType> | number
          }
        }
      }
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Category: {
        payload: Prisma.$CategoryPayload<ExtArgs>
        fields: Prisma.CategoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CategoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CategoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          findFirst: {
            args: Prisma.CategoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CategoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          findMany: {
            args: Prisma.CategoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>[]
          }
          create: {
            args: Prisma.CategoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          createMany: {
            args: Prisma.CategoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CategoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>[]
          }
          delete: {
            args: Prisma.CategoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          update: {
            args: Prisma.CategoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          deleteMany: {
            args: Prisma.CategoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CategoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CategoryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>[]
          }
          upsert: {
            args: Prisma.CategoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          aggregate: {
            args: Prisma.CategoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCategory>
          }
          groupBy: {
            args: Prisma.CategoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<CategoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.CategoryCountArgs<ExtArgs>
            result: $Utils.Optional<CategoryCountAggregateOutputType> | number
          }
        }
      }
      CategoryTranslation: {
        payload: Prisma.$CategoryTranslationPayload<ExtArgs>
        fields: Prisma.CategoryTranslationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CategoryTranslationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CategoryTranslationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>
          }
          findFirst: {
            args: Prisma.CategoryTranslationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CategoryTranslationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>
          }
          findMany: {
            args: Prisma.CategoryTranslationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>[]
          }
          create: {
            args: Prisma.CategoryTranslationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>
          }
          createMany: {
            args: Prisma.CategoryTranslationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CategoryTranslationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>[]
          }
          delete: {
            args: Prisma.CategoryTranslationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>
          }
          update: {
            args: Prisma.CategoryTranslationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>
          }
          deleteMany: {
            args: Prisma.CategoryTranslationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CategoryTranslationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CategoryTranslationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>[]
          }
          upsert: {
            args: Prisma.CategoryTranslationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryTranslationPayload>
          }
          aggregate: {
            args: Prisma.CategoryTranslationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCategoryTranslation>
          }
          groupBy: {
            args: Prisma.CategoryTranslationGroupByArgs<ExtArgs>
            result: $Utils.Optional<CategoryTranslationGroupByOutputType>[]
          }
          count: {
            args: Prisma.CategoryTranslationCountArgs<ExtArgs>
            result: $Utils.Optional<CategoryTranslationCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    language?: LanguageOmit
    state?: StateOmit
    role?: RoleOmit
    user?: UserOmit
    category?: CategoryOmit
    categoryTranslation?: CategoryTranslationOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type LanguageCountOutputType
   */

  export type LanguageCountOutputType = {
    states: number
    users: number
    CategoryTranslation: number
  }

  export type LanguageCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    states?: boolean | LanguageCountOutputTypeCountStatesArgs
    users?: boolean | LanguageCountOutputTypeCountUsersArgs
    CategoryTranslation?: boolean | LanguageCountOutputTypeCountCategoryTranslationArgs
  }

  // Custom InputTypes
  /**
   * LanguageCountOutputType without action
   */
  export type LanguageCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LanguageCountOutputType
     */
    select?: LanguageCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * LanguageCountOutputType without action
   */
  export type LanguageCountOutputTypeCountStatesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: StateWhereInput
  }

  /**
   * LanguageCountOutputType without action
   */
  export type LanguageCountOutputTypeCountUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
  }

  /**
   * LanguageCountOutputType without action
   */
  export type LanguageCountOutputTypeCountCategoryTranslationArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CategoryTranslationWhereInput
  }


  /**
   * Count Type StateCountOutputType
   */

  export type StateCountOutputType = {
    users: number
  }

  export type StateCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    users?: boolean | StateCountOutputTypeCountUsersArgs
  }

  // Custom InputTypes
  /**
   * StateCountOutputType without action
   */
  export type StateCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the StateCountOutputType
     */
    select?: StateCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * StateCountOutputType without action
   */
  export type StateCountOutputTypeCountUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
  }


  /**
   * Count Type RoleCountOutputType
   */

  export type RoleCountOutputType = {
    users: number
  }

  export type RoleCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    users?: boolean | RoleCountOutputTypeCountUsersArgs
  }

  // Custom InputTypes
  /**
   * RoleCountOutputType without action
   */
  export type RoleCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleCountOutputType
     */
    select?: RoleCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * RoleCountOutputType without action
   */
  export type RoleCountOutputTypeCountUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
  }


  /**
   * Count Type CategoryCountOutputType
   */

  export type CategoryCountOutputType = {
    translations: number
  }

  export type CategoryCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    translations?: boolean | CategoryCountOutputTypeCountTranslationsArgs
  }

  // Custom InputTypes
  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryCountOutputType
     */
    select?: CategoryCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeCountTranslationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CategoryTranslationWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Language
   */

  export type AggregateLanguage = {
    _count: LanguageCountAggregateOutputType | null
    _min: LanguageMinAggregateOutputType | null
    _max: LanguageMaxAggregateOutputType | null
  }

  export type LanguageMinAggregateOutputType = {
    languageId: string | null
    name: string | null
    code: string | null
    isRTL: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type LanguageMaxAggregateOutputType = {
    languageId: string | null
    name: string | null
    code: string | null
    isRTL: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type LanguageCountAggregateOutputType = {
    languageId: number
    name: number
    code: number
    isRTL: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type LanguageMinAggregateInputType = {
    languageId?: true
    name?: true
    code?: true
    isRTL?: true
    createdAt?: true
    updatedAt?: true
  }

  export type LanguageMaxAggregateInputType = {
    languageId?: true
    name?: true
    code?: true
    isRTL?: true
    createdAt?: true
    updatedAt?: true
  }

  export type LanguageCountAggregateInputType = {
    languageId?: true
    name?: true
    code?: true
    isRTL?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type LanguageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Language to aggregate.
     */
    where?: LanguageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Languages to fetch.
     */
    orderBy?: LanguageOrderByWithRelationInput | LanguageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: LanguageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Languages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Languages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Languages
    **/
    _count?: true | LanguageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: LanguageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: LanguageMaxAggregateInputType
  }

  export type GetLanguageAggregateType<T extends LanguageAggregateArgs> = {
        [P in keyof T & keyof AggregateLanguage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateLanguage[P]>
      : GetScalarType<T[P], AggregateLanguage[P]>
  }




  export type LanguageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LanguageWhereInput
    orderBy?: LanguageOrderByWithAggregationInput | LanguageOrderByWithAggregationInput[]
    by: LanguageScalarFieldEnum[] | LanguageScalarFieldEnum
    having?: LanguageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: LanguageCountAggregateInputType | true
    _min?: LanguageMinAggregateInputType
    _max?: LanguageMaxAggregateInputType
  }

  export type LanguageGroupByOutputType = {
    languageId: string
    name: string
    code: string
    isRTL: boolean
    createdAt: Date
    updatedAt: Date
    _count: LanguageCountAggregateOutputType | null
    _min: LanguageMinAggregateOutputType | null
    _max: LanguageMaxAggregateOutputType | null
  }

  type GetLanguageGroupByPayload<T extends LanguageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<LanguageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof LanguageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], LanguageGroupByOutputType[P]>
            : GetScalarType<T[P], LanguageGroupByOutputType[P]>
        }
      >
    >


  export type LanguageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    languageId?: boolean
    name?: boolean
    code?: boolean
    isRTL?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    states?: boolean | Language$statesArgs<ExtArgs>
    users?: boolean | Language$usersArgs<ExtArgs>
    CategoryTranslation?: boolean | Language$CategoryTranslationArgs<ExtArgs>
    _count?: boolean | LanguageCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["language"]>

  export type LanguageSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    languageId?: boolean
    name?: boolean
    code?: boolean
    isRTL?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["language"]>

  export type LanguageSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    languageId?: boolean
    name?: boolean
    code?: boolean
    isRTL?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["language"]>

  export type LanguageSelectScalar = {
    languageId?: boolean
    name?: boolean
    code?: boolean
    isRTL?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type LanguageOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"languageId" | "name" | "code" | "isRTL" | "createdAt" | "updatedAt", ExtArgs["result"]["language"]>
  export type LanguageInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    states?: boolean | Language$statesArgs<ExtArgs>
    users?: boolean | Language$usersArgs<ExtArgs>
    CategoryTranslation?: boolean | Language$CategoryTranslationArgs<ExtArgs>
    _count?: boolean | LanguageCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type LanguageIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type LanguageIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $LanguagePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Language"
    objects: {
      states: Prisma.$StatePayload<ExtArgs>[]
      users: Prisma.$UserPayload<ExtArgs>[]
      CategoryTranslation: Prisma.$CategoryTranslationPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      languageId: string
      name: string
      code: string
      isRTL: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["language"]>
    composites: {}
  }

  type LanguageGetPayload<S extends boolean | null | undefined | LanguageDefaultArgs> = $Result.GetResult<Prisma.$LanguagePayload, S>

  type LanguageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<LanguageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: LanguageCountAggregateInputType | true
    }

  export interface LanguageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Language'], meta: { name: 'Language' } }
    /**
     * Find zero or one Language that matches the filter.
     * @param {LanguageFindUniqueArgs} args - Arguments to find a Language
     * @example
     * // Get one Language
     * const language = await prisma.language.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends LanguageFindUniqueArgs>(args: SelectSubset<T, LanguageFindUniqueArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Language that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {LanguageFindUniqueOrThrowArgs} args - Arguments to find a Language
     * @example
     * // Get one Language
     * const language = await prisma.language.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends LanguageFindUniqueOrThrowArgs>(args: SelectSubset<T, LanguageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Language that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LanguageFindFirstArgs} args - Arguments to find a Language
     * @example
     * // Get one Language
     * const language = await prisma.language.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends LanguageFindFirstArgs>(args?: SelectSubset<T, LanguageFindFirstArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Language that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LanguageFindFirstOrThrowArgs} args - Arguments to find a Language
     * @example
     * // Get one Language
     * const language = await prisma.language.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends LanguageFindFirstOrThrowArgs>(args?: SelectSubset<T, LanguageFindFirstOrThrowArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Languages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LanguageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Languages
     * const languages = await prisma.language.findMany()
     * 
     * // Get first 10 Languages
     * const languages = await prisma.language.findMany({ take: 10 })
     * 
     * // Only select the `languageId`
     * const languageWithLanguageIdOnly = await prisma.language.findMany({ select: { languageId: true } })
     * 
     */
    findMany<T extends LanguageFindManyArgs>(args?: SelectSubset<T, LanguageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Language.
     * @param {LanguageCreateArgs} args - Arguments to create a Language.
     * @example
     * // Create one Language
     * const Language = await prisma.language.create({
     *   data: {
     *     // ... data to create a Language
     *   }
     * })
     * 
     */
    create<T extends LanguageCreateArgs>(args: SelectSubset<T, LanguageCreateArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Languages.
     * @param {LanguageCreateManyArgs} args - Arguments to create many Languages.
     * @example
     * // Create many Languages
     * const language = await prisma.language.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends LanguageCreateManyArgs>(args?: SelectSubset<T, LanguageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Languages and returns the data saved in the database.
     * @param {LanguageCreateManyAndReturnArgs} args - Arguments to create many Languages.
     * @example
     * // Create many Languages
     * const language = await prisma.language.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Languages and only return the `languageId`
     * const languageWithLanguageIdOnly = await prisma.language.createManyAndReturn({
     *   select: { languageId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends LanguageCreateManyAndReturnArgs>(args?: SelectSubset<T, LanguageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Language.
     * @param {LanguageDeleteArgs} args - Arguments to delete one Language.
     * @example
     * // Delete one Language
     * const Language = await prisma.language.delete({
     *   where: {
     *     // ... filter to delete one Language
     *   }
     * })
     * 
     */
    delete<T extends LanguageDeleteArgs>(args: SelectSubset<T, LanguageDeleteArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Language.
     * @param {LanguageUpdateArgs} args - Arguments to update one Language.
     * @example
     * // Update one Language
     * const language = await prisma.language.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends LanguageUpdateArgs>(args: SelectSubset<T, LanguageUpdateArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Languages.
     * @param {LanguageDeleteManyArgs} args - Arguments to filter Languages to delete.
     * @example
     * // Delete a few Languages
     * const { count } = await prisma.language.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends LanguageDeleteManyArgs>(args?: SelectSubset<T, LanguageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Languages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LanguageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Languages
     * const language = await prisma.language.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends LanguageUpdateManyArgs>(args: SelectSubset<T, LanguageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Languages and returns the data updated in the database.
     * @param {LanguageUpdateManyAndReturnArgs} args - Arguments to update many Languages.
     * @example
     * // Update many Languages
     * const language = await prisma.language.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Languages and only return the `languageId`
     * const languageWithLanguageIdOnly = await prisma.language.updateManyAndReturn({
     *   select: { languageId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends LanguageUpdateManyAndReturnArgs>(args: SelectSubset<T, LanguageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Language.
     * @param {LanguageUpsertArgs} args - Arguments to update or create a Language.
     * @example
     * // Update or create a Language
     * const language = await prisma.language.upsert({
     *   create: {
     *     // ... data to create a Language
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Language we want to update
     *   }
     * })
     */
    upsert<T extends LanguageUpsertArgs>(args: SelectSubset<T, LanguageUpsertArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Languages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LanguageCountArgs} args - Arguments to filter Languages to count.
     * @example
     * // Count the number of Languages
     * const count = await prisma.language.count({
     *   where: {
     *     // ... the filter for the Languages we want to count
     *   }
     * })
    **/
    count<T extends LanguageCountArgs>(
      args?: Subset<T, LanguageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], LanguageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Language.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LanguageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends LanguageAggregateArgs>(args: Subset<T, LanguageAggregateArgs>): Prisma.PrismaPromise<GetLanguageAggregateType<T>>

    /**
     * Group by Language.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LanguageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends LanguageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: LanguageGroupByArgs['orderBy'] }
        : { orderBy?: LanguageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, LanguageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetLanguageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Language model
   */
  readonly fields: LanguageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Language.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__LanguageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    states<T extends Language$statesArgs<ExtArgs> = {}>(args?: Subset<T, Language$statesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    users<T extends Language$usersArgs<ExtArgs> = {}>(args?: Subset<T, Language$usersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    CategoryTranslation<T extends Language$CategoryTranslationArgs<ExtArgs> = {}>(args?: Subset<T, Language$CategoryTranslationArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Language model
   */
  interface LanguageFieldRefs {
    readonly languageId: FieldRef<"Language", 'String'>
    readonly name: FieldRef<"Language", 'String'>
    readonly code: FieldRef<"Language", 'String'>
    readonly isRTL: FieldRef<"Language", 'Boolean'>
    readonly createdAt: FieldRef<"Language", 'DateTime'>
    readonly updatedAt: FieldRef<"Language", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Language findUnique
   */
  export type LanguageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * Filter, which Language to fetch.
     */
    where: LanguageWhereUniqueInput
  }

  /**
   * Language findUniqueOrThrow
   */
  export type LanguageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * Filter, which Language to fetch.
     */
    where: LanguageWhereUniqueInput
  }

  /**
   * Language findFirst
   */
  export type LanguageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * Filter, which Language to fetch.
     */
    where?: LanguageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Languages to fetch.
     */
    orderBy?: LanguageOrderByWithRelationInput | LanguageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Languages.
     */
    cursor?: LanguageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Languages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Languages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Languages.
     */
    distinct?: LanguageScalarFieldEnum | LanguageScalarFieldEnum[]
  }

  /**
   * Language findFirstOrThrow
   */
  export type LanguageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * Filter, which Language to fetch.
     */
    where?: LanguageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Languages to fetch.
     */
    orderBy?: LanguageOrderByWithRelationInput | LanguageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Languages.
     */
    cursor?: LanguageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Languages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Languages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Languages.
     */
    distinct?: LanguageScalarFieldEnum | LanguageScalarFieldEnum[]
  }

  /**
   * Language findMany
   */
  export type LanguageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * Filter, which Languages to fetch.
     */
    where?: LanguageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Languages to fetch.
     */
    orderBy?: LanguageOrderByWithRelationInput | LanguageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Languages.
     */
    cursor?: LanguageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Languages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Languages.
     */
    skip?: number
    distinct?: LanguageScalarFieldEnum | LanguageScalarFieldEnum[]
  }

  /**
   * Language create
   */
  export type LanguageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * The data needed to create a Language.
     */
    data: XOR<LanguageCreateInput, LanguageUncheckedCreateInput>
  }

  /**
   * Language createMany
   */
  export type LanguageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Languages.
     */
    data: LanguageCreateManyInput | LanguageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Language createManyAndReturn
   */
  export type LanguageCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * The data used to create many Languages.
     */
    data: LanguageCreateManyInput | LanguageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Language update
   */
  export type LanguageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * The data needed to update a Language.
     */
    data: XOR<LanguageUpdateInput, LanguageUncheckedUpdateInput>
    /**
     * Choose, which Language to update.
     */
    where: LanguageWhereUniqueInput
  }

  /**
   * Language updateMany
   */
  export type LanguageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Languages.
     */
    data: XOR<LanguageUpdateManyMutationInput, LanguageUncheckedUpdateManyInput>
    /**
     * Filter which Languages to update
     */
    where?: LanguageWhereInput
    /**
     * Limit how many Languages to update.
     */
    limit?: number
  }

  /**
   * Language updateManyAndReturn
   */
  export type LanguageUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * The data used to update Languages.
     */
    data: XOR<LanguageUpdateManyMutationInput, LanguageUncheckedUpdateManyInput>
    /**
     * Filter which Languages to update
     */
    where?: LanguageWhereInput
    /**
     * Limit how many Languages to update.
     */
    limit?: number
  }

  /**
   * Language upsert
   */
  export type LanguageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * The filter to search for the Language to update in case it exists.
     */
    where: LanguageWhereUniqueInput
    /**
     * In case the Language found by the `where` argument doesn't exist, create a new Language with this data.
     */
    create: XOR<LanguageCreateInput, LanguageUncheckedCreateInput>
    /**
     * In case the Language was found with the provided `where` argument, update it with this data.
     */
    update: XOR<LanguageUpdateInput, LanguageUncheckedUpdateInput>
  }

  /**
   * Language delete
   */
  export type LanguageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    /**
     * Filter which Language to delete.
     */
    where: LanguageWhereUniqueInput
  }

  /**
   * Language deleteMany
   */
  export type LanguageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Languages to delete
     */
    where?: LanguageWhereInput
    /**
     * Limit how many Languages to delete.
     */
    limit?: number
  }

  /**
   * Language.states
   */
  export type Language$statesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    where?: StateWhereInput
    orderBy?: StateOrderByWithRelationInput | StateOrderByWithRelationInput[]
    cursor?: StateWhereUniqueInput
    take?: number
    skip?: number
    distinct?: StateScalarFieldEnum | StateScalarFieldEnum[]
  }

  /**
   * Language.users
   */
  export type Language$usersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    cursor?: UserWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * Language.CategoryTranslation
   */
  export type Language$CategoryTranslationArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    where?: CategoryTranslationWhereInput
    orderBy?: CategoryTranslationOrderByWithRelationInput | CategoryTranslationOrderByWithRelationInput[]
    cursor?: CategoryTranslationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CategoryTranslationScalarFieldEnum | CategoryTranslationScalarFieldEnum[]
  }

  /**
   * Language without action
   */
  export type LanguageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
  }


  /**
   * Model State
   */

  export type AggregateState = {
    _count: StateCountAggregateOutputType | null
    _min: StateMinAggregateOutputType | null
    _max: StateMaxAggregateOutputType | null
  }

  export type StateMinAggregateOutputType = {
    stateId: string | null
    name: string | null
    languageId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type StateMaxAggregateOutputType = {
    stateId: string | null
    name: string | null
    languageId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type StateCountAggregateOutputType = {
    stateId: number
    name: number
    languageId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type StateMinAggregateInputType = {
    stateId?: true
    name?: true
    languageId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type StateMaxAggregateInputType = {
    stateId?: true
    name?: true
    languageId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type StateCountAggregateInputType = {
    stateId?: true
    name?: true
    languageId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type StateAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which State to aggregate.
     */
    where?: StateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of States to fetch.
     */
    orderBy?: StateOrderByWithRelationInput | StateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: StateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` States from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` States.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned States
    **/
    _count?: true | StateCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: StateMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: StateMaxAggregateInputType
  }

  export type GetStateAggregateType<T extends StateAggregateArgs> = {
        [P in keyof T & keyof AggregateState]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateState[P]>
      : GetScalarType<T[P], AggregateState[P]>
  }




  export type StateGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: StateWhereInput
    orderBy?: StateOrderByWithAggregationInput | StateOrderByWithAggregationInput[]
    by: StateScalarFieldEnum[] | StateScalarFieldEnum
    having?: StateScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: StateCountAggregateInputType | true
    _min?: StateMinAggregateInputType
    _max?: StateMaxAggregateInputType
  }

  export type StateGroupByOutputType = {
    stateId: string
    name: string
    languageId: string
    createdAt: Date
    updatedAt: Date
    _count: StateCountAggregateOutputType | null
    _min: StateMinAggregateOutputType | null
    _max: StateMaxAggregateOutputType | null
  }

  type GetStateGroupByPayload<T extends StateGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<StateGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof StateGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], StateGroupByOutputType[P]>
            : GetScalarType<T[P], StateGroupByOutputType[P]>
        }
      >
    >


  export type StateSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    stateId?: boolean
    name?: boolean
    languageId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    language?: boolean | LanguageDefaultArgs<ExtArgs>
    users?: boolean | State$usersArgs<ExtArgs>
    _count?: boolean | StateCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["state"]>

  export type StateSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    stateId?: boolean
    name?: boolean
    languageId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["state"]>

  export type StateSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    stateId?: boolean
    name?: boolean
    languageId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["state"]>

  export type StateSelectScalar = {
    stateId?: boolean
    name?: boolean
    languageId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type StateOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"stateId" | "name" | "languageId" | "createdAt" | "updatedAt", ExtArgs["result"]["state"]>
  export type StateInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    language?: boolean | LanguageDefaultArgs<ExtArgs>
    users?: boolean | State$usersArgs<ExtArgs>
    _count?: boolean | StateCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type StateIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }
  export type StateIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }

  export type $StatePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "State"
    objects: {
      language: Prisma.$LanguagePayload<ExtArgs>
      users: Prisma.$UserPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      stateId: string
      name: string
      languageId: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["state"]>
    composites: {}
  }

  type StateGetPayload<S extends boolean | null | undefined | StateDefaultArgs> = $Result.GetResult<Prisma.$StatePayload, S>

  type StateCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<StateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: StateCountAggregateInputType | true
    }

  export interface StateDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['State'], meta: { name: 'State' } }
    /**
     * Find zero or one State that matches the filter.
     * @param {StateFindUniqueArgs} args - Arguments to find a State
     * @example
     * // Get one State
     * const state = await prisma.state.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends StateFindUniqueArgs>(args: SelectSubset<T, StateFindUniqueArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one State that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {StateFindUniqueOrThrowArgs} args - Arguments to find a State
     * @example
     * // Get one State
     * const state = await prisma.state.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends StateFindUniqueOrThrowArgs>(args: SelectSubset<T, StateFindUniqueOrThrowArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first State that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StateFindFirstArgs} args - Arguments to find a State
     * @example
     * // Get one State
     * const state = await prisma.state.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends StateFindFirstArgs>(args?: SelectSubset<T, StateFindFirstArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first State that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StateFindFirstOrThrowArgs} args - Arguments to find a State
     * @example
     * // Get one State
     * const state = await prisma.state.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends StateFindFirstOrThrowArgs>(args?: SelectSubset<T, StateFindFirstOrThrowArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more States that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all States
     * const states = await prisma.state.findMany()
     * 
     * // Get first 10 States
     * const states = await prisma.state.findMany({ take: 10 })
     * 
     * // Only select the `stateId`
     * const stateWithStateIdOnly = await prisma.state.findMany({ select: { stateId: true } })
     * 
     */
    findMany<T extends StateFindManyArgs>(args?: SelectSubset<T, StateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a State.
     * @param {StateCreateArgs} args - Arguments to create a State.
     * @example
     * // Create one State
     * const State = await prisma.state.create({
     *   data: {
     *     // ... data to create a State
     *   }
     * })
     * 
     */
    create<T extends StateCreateArgs>(args: SelectSubset<T, StateCreateArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many States.
     * @param {StateCreateManyArgs} args - Arguments to create many States.
     * @example
     * // Create many States
     * const state = await prisma.state.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends StateCreateManyArgs>(args?: SelectSubset<T, StateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many States and returns the data saved in the database.
     * @param {StateCreateManyAndReturnArgs} args - Arguments to create many States.
     * @example
     * // Create many States
     * const state = await prisma.state.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many States and only return the `stateId`
     * const stateWithStateIdOnly = await prisma.state.createManyAndReturn({
     *   select: { stateId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends StateCreateManyAndReturnArgs>(args?: SelectSubset<T, StateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a State.
     * @param {StateDeleteArgs} args - Arguments to delete one State.
     * @example
     * // Delete one State
     * const State = await prisma.state.delete({
     *   where: {
     *     // ... filter to delete one State
     *   }
     * })
     * 
     */
    delete<T extends StateDeleteArgs>(args: SelectSubset<T, StateDeleteArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one State.
     * @param {StateUpdateArgs} args - Arguments to update one State.
     * @example
     * // Update one State
     * const state = await prisma.state.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends StateUpdateArgs>(args: SelectSubset<T, StateUpdateArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more States.
     * @param {StateDeleteManyArgs} args - Arguments to filter States to delete.
     * @example
     * // Delete a few States
     * const { count } = await prisma.state.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends StateDeleteManyArgs>(args?: SelectSubset<T, StateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more States.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many States
     * const state = await prisma.state.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends StateUpdateManyArgs>(args: SelectSubset<T, StateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more States and returns the data updated in the database.
     * @param {StateUpdateManyAndReturnArgs} args - Arguments to update many States.
     * @example
     * // Update many States
     * const state = await prisma.state.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more States and only return the `stateId`
     * const stateWithStateIdOnly = await prisma.state.updateManyAndReturn({
     *   select: { stateId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends StateUpdateManyAndReturnArgs>(args: SelectSubset<T, StateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one State.
     * @param {StateUpsertArgs} args - Arguments to update or create a State.
     * @example
     * // Update or create a State
     * const state = await prisma.state.upsert({
     *   create: {
     *     // ... data to create a State
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the State we want to update
     *   }
     * })
     */
    upsert<T extends StateUpsertArgs>(args: SelectSubset<T, StateUpsertArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of States.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StateCountArgs} args - Arguments to filter States to count.
     * @example
     * // Count the number of States
     * const count = await prisma.state.count({
     *   where: {
     *     // ... the filter for the States we want to count
     *   }
     * })
    **/
    count<T extends StateCountArgs>(
      args?: Subset<T, StateCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], StateCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a State.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends StateAggregateArgs>(args: Subset<T, StateAggregateArgs>): Prisma.PrismaPromise<GetStateAggregateType<T>>

    /**
     * Group by State.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StateGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends StateGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: StateGroupByArgs['orderBy'] }
        : { orderBy?: StateGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, StateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetStateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the State model
   */
  readonly fields: StateFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for State.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__StateClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    language<T extends LanguageDefaultArgs<ExtArgs> = {}>(args?: Subset<T, LanguageDefaultArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    users<T extends State$usersArgs<ExtArgs> = {}>(args?: Subset<T, State$usersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the State model
   */
  interface StateFieldRefs {
    readonly stateId: FieldRef<"State", 'String'>
    readonly name: FieldRef<"State", 'String'>
    readonly languageId: FieldRef<"State", 'String'>
    readonly createdAt: FieldRef<"State", 'DateTime'>
    readonly updatedAt: FieldRef<"State", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * State findUnique
   */
  export type StateFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * Filter, which State to fetch.
     */
    where: StateWhereUniqueInput
  }

  /**
   * State findUniqueOrThrow
   */
  export type StateFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * Filter, which State to fetch.
     */
    where: StateWhereUniqueInput
  }

  /**
   * State findFirst
   */
  export type StateFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * Filter, which State to fetch.
     */
    where?: StateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of States to fetch.
     */
    orderBy?: StateOrderByWithRelationInput | StateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for States.
     */
    cursor?: StateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` States from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` States.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of States.
     */
    distinct?: StateScalarFieldEnum | StateScalarFieldEnum[]
  }

  /**
   * State findFirstOrThrow
   */
  export type StateFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * Filter, which State to fetch.
     */
    where?: StateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of States to fetch.
     */
    orderBy?: StateOrderByWithRelationInput | StateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for States.
     */
    cursor?: StateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` States from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` States.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of States.
     */
    distinct?: StateScalarFieldEnum | StateScalarFieldEnum[]
  }

  /**
   * State findMany
   */
  export type StateFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * Filter, which States to fetch.
     */
    where?: StateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of States to fetch.
     */
    orderBy?: StateOrderByWithRelationInput | StateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing States.
     */
    cursor?: StateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` States from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` States.
     */
    skip?: number
    distinct?: StateScalarFieldEnum | StateScalarFieldEnum[]
  }

  /**
   * State create
   */
  export type StateCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * The data needed to create a State.
     */
    data: XOR<StateCreateInput, StateUncheckedCreateInput>
  }

  /**
   * State createMany
   */
  export type StateCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many States.
     */
    data: StateCreateManyInput | StateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * State createManyAndReturn
   */
  export type StateCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * The data used to create many States.
     */
    data: StateCreateManyInput | StateCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * State update
   */
  export type StateUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * The data needed to update a State.
     */
    data: XOR<StateUpdateInput, StateUncheckedUpdateInput>
    /**
     * Choose, which State to update.
     */
    where: StateWhereUniqueInput
  }

  /**
   * State updateMany
   */
  export type StateUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update States.
     */
    data: XOR<StateUpdateManyMutationInput, StateUncheckedUpdateManyInput>
    /**
     * Filter which States to update
     */
    where?: StateWhereInput
    /**
     * Limit how many States to update.
     */
    limit?: number
  }

  /**
   * State updateManyAndReturn
   */
  export type StateUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * The data used to update States.
     */
    data: XOR<StateUpdateManyMutationInput, StateUncheckedUpdateManyInput>
    /**
     * Filter which States to update
     */
    where?: StateWhereInput
    /**
     * Limit how many States to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * State upsert
   */
  export type StateUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * The filter to search for the State to update in case it exists.
     */
    where: StateWhereUniqueInput
    /**
     * In case the State found by the `where` argument doesn't exist, create a new State with this data.
     */
    create: XOR<StateCreateInput, StateUncheckedCreateInput>
    /**
     * In case the State was found with the provided `where` argument, update it with this data.
     */
    update: XOR<StateUpdateInput, StateUncheckedUpdateInput>
  }

  /**
   * State delete
   */
  export type StateDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    /**
     * Filter which State to delete.
     */
    where: StateWhereUniqueInput
  }

  /**
   * State deleteMany
   */
  export type StateDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which States to delete
     */
    where?: StateWhereInput
    /**
     * Limit how many States to delete.
     */
    limit?: number
  }

  /**
   * State.users
   */
  export type State$usersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    cursor?: UserWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * State without action
   */
  export type StateDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
  }


  /**
   * Model Role
   */

  export type AggregateRole = {
    _count: RoleCountAggregateOutputType | null
    _min: RoleMinAggregateOutputType | null
    _max: RoleMaxAggregateOutputType | null
  }

  export type RoleMinAggregateOutputType = {
    roleId: string | null
    name: $Enums.RoleName | null
    createdAt: Date | null
  }

  export type RoleMaxAggregateOutputType = {
    roleId: string | null
    name: $Enums.RoleName | null
    createdAt: Date | null
  }

  export type RoleCountAggregateOutputType = {
    roleId: number
    name: number
    permissions: number
    createdAt: number
    _all: number
  }


  export type RoleMinAggregateInputType = {
    roleId?: true
    name?: true
    createdAt?: true
  }

  export type RoleMaxAggregateInputType = {
    roleId?: true
    name?: true
    createdAt?: true
  }

  export type RoleCountAggregateInputType = {
    roleId?: true
    name?: true
    permissions?: true
    createdAt?: true
    _all?: true
  }

  export type RoleAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Role to aggregate.
     */
    where?: RoleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Roles to fetch.
     */
    orderBy?: RoleOrderByWithRelationInput | RoleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RoleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Roles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Roles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Roles
    **/
    _count?: true | RoleCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RoleMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RoleMaxAggregateInputType
  }

  export type GetRoleAggregateType<T extends RoleAggregateArgs> = {
        [P in keyof T & keyof AggregateRole]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRole[P]>
      : GetScalarType<T[P], AggregateRole[P]>
  }




  export type RoleGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RoleWhereInput
    orderBy?: RoleOrderByWithAggregationInput | RoleOrderByWithAggregationInput[]
    by: RoleScalarFieldEnum[] | RoleScalarFieldEnum
    having?: RoleScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RoleCountAggregateInputType | true
    _min?: RoleMinAggregateInputType
    _max?: RoleMaxAggregateInputType
  }

  export type RoleGroupByOutputType = {
    roleId: string
    name: $Enums.RoleName
    permissions: JsonValue
    createdAt: Date
    _count: RoleCountAggregateOutputType | null
    _min: RoleMinAggregateOutputType | null
    _max: RoleMaxAggregateOutputType | null
  }

  type GetRoleGroupByPayload<T extends RoleGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RoleGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RoleGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RoleGroupByOutputType[P]>
            : GetScalarType<T[P], RoleGroupByOutputType[P]>
        }
      >
    >


  export type RoleSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    roleId?: boolean
    name?: boolean
    permissions?: boolean
    createdAt?: boolean
    users?: boolean | Role$usersArgs<ExtArgs>
    _count?: boolean | RoleCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["role"]>

  export type RoleSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    roleId?: boolean
    name?: boolean
    permissions?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["role"]>

  export type RoleSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    roleId?: boolean
    name?: boolean
    permissions?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["role"]>

  export type RoleSelectScalar = {
    roleId?: boolean
    name?: boolean
    permissions?: boolean
    createdAt?: boolean
  }

  export type RoleOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"roleId" | "name" | "permissions" | "createdAt", ExtArgs["result"]["role"]>
  export type RoleInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    users?: boolean | Role$usersArgs<ExtArgs>
    _count?: boolean | RoleCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type RoleIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type RoleIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $RolePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Role"
    objects: {
      users: Prisma.$UserPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      roleId: string
      name: $Enums.RoleName
      permissions: Prisma.JsonValue
      createdAt: Date
    }, ExtArgs["result"]["role"]>
    composites: {}
  }

  type RoleGetPayload<S extends boolean | null | undefined | RoleDefaultArgs> = $Result.GetResult<Prisma.$RolePayload, S>

  type RoleCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RoleFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RoleCountAggregateInputType | true
    }

  export interface RoleDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Role'], meta: { name: 'Role' } }
    /**
     * Find zero or one Role that matches the filter.
     * @param {RoleFindUniqueArgs} args - Arguments to find a Role
     * @example
     * // Get one Role
     * const role = await prisma.role.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RoleFindUniqueArgs>(args: SelectSubset<T, RoleFindUniqueArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Role that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RoleFindUniqueOrThrowArgs} args - Arguments to find a Role
     * @example
     * // Get one Role
     * const role = await prisma.role.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RoleFindUniqueOrThrowArgs>(args: SelectSubset<T, RoleFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Role that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleFindFirstArgs} args - Arguments to find a Role
     * @example
     * // Get one Role
     * const role = await prisma.role.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RoleFindFirstArgs>(args?: SelectSubset<T, RoleFindFirstArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Role that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleFindFirstOrThrowArgs} args - Arguments to find a Role
     * @example
     * // Get one Role
     * const role = await prisma.role.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RoleFindFirstOrThrowArgs>(args?: SelectSubset<T, RoleFindFirstOrThrowArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Roles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Roles
     * const roles = await prisma.role.findMany()
     * 
     * // Get first 10 Roles
     * const roles = await prisma.role.findMany({ take: 10 })
     * 
     * // Only select the `roleId`
     * const roleWithRoleIdOnly = await prisma.role.findMany({ select: { roleId: true } })
     * 
     */
    findMany<T extends RoleFindManyArgs>(args?: SelectSubset<T, RoleFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Role.
     * @param {RoleCreateArgs} args - Arguments to create a Role.
     * @example
     * // Create one Role
     * const Role = await prisma.role.create({
     *   data: {
     *     // ... data to create a Role
     *   }
     * })
     * 
     */
    create<T extends RoleCreateArgs>(args: SelectSubset<T, RoleCreateArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Roles.
     * @param {RoleCreateManyArgs} args - Arguments to create many Roles.
     * @example
     * // Create many Roles
     * const role = await prisma.role.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RoleCreateManyArgs>(args?: SelectSubset<T, RoleCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Roles and returns the data saved in the database.
     * @param {RoleCreateManyAndReturnArgs} args - Arguments to create many Roles.
     * @example
     * // Create many Roles
     * const role = await prisma.role.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Roles and only return the `roleId`
     * const roleWithRoleIdOnly = await prisma.role.createManyAndReturn({
     *   select: { roleId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RoleCreateManyAndReturnArgs>(args?: SelectSubset<T, RoleCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Role.
     * @param {RoleDeleteArgs} args - Arguments to delete one Role.
     * @example
     * // Delete one Role
     * const Role = await prisma.role.delete({
     *   where: {
     *     // ... filter to delete one Role
     *   }
     * })
     * 
     */
    delete<T extends RoleDeleteArgs>(args: SelectSubset<T, RoleDeleteArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Role.
     * @param {RoleUpdateArgs} args - Arguments to update one Role.
     * @example
     * // Update one Role
     * const role = await prisma.role.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RoleUpdateArgs>(args: SelectSubset<T, RoleUpdateArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Roles.
     * @param {RoleDeleteManyArgs} args - Arguments to filter Roles to delete.
     * @example
     * // Delete a few Roles
     * const { count } = await prisma.role.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RoleDeleteManyArgs>(args?: SelectSubset<T, RoleDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Roles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Roles
     * const role = await prisma.role.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RoleUpdateManyArgs>(args: SelectSubset<T, RoleUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Roles and returns the data updated in the database.
     * @param {RoleUpdateManyAndReturnArgs} args - Arguments to update many Roles.
     * @example
     * // Update many Roles
     * const role = await prisma.role.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Roles and only return the `roleId`
     * const roleWithRoleIdOnly = await prisma.role.updateManyAndReturn({
     *   select: { roleId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends RoleUpdateManyAndReturnArgs>(args: SelectSubset<T, RoleUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Role.
     * @param {RoleUpsertArgs} args - Arguments to update or create a Role.
     * @example
     * // Update or create a Role
     * const role = await prisma.role.upsert({
     *   create: {
     *     // ... data to create a Role
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Role we want to update
     *   }
     * })
     */
    upsert<T extends RoleUpsertArgs>(args: SelectSubset<T, RoleUpsertArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Roles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleCountArgs} args - Arguments to filter Roles to count.
     * @example
     * // Count the number of Roles
     * const count = await prisma.role.count({
     *   where: {
     *     // ... the filter for the Roles we want to count
     *   }
     * })
    **/
    count<T extends RoleCountArgs>(
      args?: Subset<T, RoleCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RoleCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Role.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RoleAggregateArgs>(args: Subset<T, RoleAggregateArgs>): Prisma.PrismaPromise<GetRoleAggregateType<T>>

    /**
     * Group by Role.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RoleGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RoleGroupByArgs['orderBy'] }
        : { orderBy?: RoleGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RoleGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRoleGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Role model
   */
  readonly fields: RoleFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Role.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RoleClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    users<T extends Role$usersArgs<ExtArgs> = {}>(args?: Subset<T, Role$usersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Role model
   */
  interface RoleFieldRefs {
    readonly roleId: FieldRef<"Role", 'String'>
    readonly name: FieldRef<"Role", 'RoleName'>
    readonly permissions: FieldRef<"Role", 'Json'>
    readonly createdAt: FieldRef<"Role", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Role findUnique
   */
  export type RoleFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * Filter, which Role to fetch.
     */
    where: RoleWhereUniqueInput
  }

  /**
   * Role findUniqueOrThrow
   */
  export type RoleFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * Filter, which Role to fetch.
     */
    where: RoleWhereUniqueInput
  }

  /**
   * Role findFirst
   */
  export type RoleFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * Filter, which Role to fetch.
     */
    where?: RoleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Roles to fetch.
     */
    orderBy?: RoleOrderByWithRelationInput | RoleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Roles.
     */
    cursor?: RoleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Roles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Roles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Roles.
     */
    distinct?: RoleScalarFieldEnum | RoleScalarFieldEnum[]
  }

  /**
   * Role findFirstOrThrow
   */
  export type RoleFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * Filter, which Role to fetch.
     */
    where?: RoleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Roles to fetch.
     */
    orderBy?: RoleOrderByWithRelationInput | RoleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Roles.
     */
    cursor?: RoleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Roles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Roles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Roles.
     */
    distinct?: RoleScalarFieldEnum | RoleScalarFieldEnum[]
  }

  /**
   * Role findMany
   */
  export type RoleFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * Filter, which Roles to fetch.
     */
    where?: RoleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Roles to fetch.
     */
    orderBy?: RoleOrderByWithRelationInput | RoleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Roles.
     */
    cursor?: RoleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Roles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Roles.
     */
    skip?: number
    distinct?: RoleScalarFieldEnum | RoleScalarFieldEnum[]
  }

  /**
   * Role create
   */
  export type RoleCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * The data needed to create a Role.
     */
    data: XOR<RoleCreateInput, RoleUncheckedCreateInput>
  }

  /**
   * Role createMany
   */
  export type RoleCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Roles.
     */
    data: RoleCreateManyInput | RoleCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Role createManyAndReturn
   */
  export type RoleCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * The data used to create many Roles.
     */
    data: RoleCreateManyInput | RoleCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Role update
   */
  export type RoleUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * The data needed to update a Role.
     */
    data: XOR<RoleUpdateInput, RoleUncheckedUpdateInput>
    /**
     * Choose, which Role to update.
     */
    where: RoleWhereUniqueInput
  }

  /**
   * Role updateMany
   */
  export type RoleUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Roles.
     */
    data: XOR<RoleUpdateManyMutationInput, RoleUncheckedUpdateManyInput>
    /**
     * Filter which Roles to update
     */
    where?: RoleWhereInput
    /**
     * Limit how many Roles to update.
     */
    limit?: number
  }

  /**
   * Role updateManyAndReturn
   */
  export type RoleUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * The data used to update Roles.
     */
    data: XOR<RoleUpdateManyMutationInput, RoleUncheckedUpdateManyInput>
    /**
     * Filter which Roles to update
     */
    where?: RoleWhereInput
    /**
     * Limit how many Roles to update.
     */
    limit?: number
  }

  /**
   * Role upsert
   */
  export type RoleUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * The filter to search for the Role to update in case it exists.
     */
    where: RoleWhereUniqueInput
    /**
     * In case the Role found by the `where` argument doesn't exist, create a new Role with this data.
     */
    create: XOR<RoleCreateInput, RoleUncheckedCreateInput>
    /**
     * In case the Role was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RoleUpdateInput, RoleUncheckedUpdateInput>
  }

  /**
   * Role delete
   */
  export type RoleDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
    /**
     * Filter which Role to delete.
     */
    where: RoleWhereUniqueInput
  }

  /**
   * Role deleteMany
   */
  export type RoleDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Roles to delete
     */
    where?: RoleWhereInput
    /**
     * Limit how many Roles to delete.
     */
    limit?: number
  }

  /**
   * Role.users
   */
  export type Role$usersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    cursor?: UserWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * Role without action
   */
  export type RoleDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Role
     */
    select?: RoleSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Role
     */
    omit?: RoleOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInclude<ExtArgs> | null
  }


  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    userId: string | null
    mobileNumber: string | null
    mpin: string | null
    deviceId: string | null
    fcmToken: string | null
    roleId: string | null
    languageId: string | null
    stateId: string | null
    isVerified: boolean | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    userId: string | null
    mobileNumber: string | null
    mpin: string | null
    deviceId: string | null
    fcmToken: string | null
    roleId: string | null
    languageId: string | null
    stateId: string | null
    isVerified: boolean | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    userId: number
    mobileNumber: number
    mpin: number
    deviceId: number
    fcmToken: number
    roleId: number
    languageId: number
    stateId: number
    isVerified: number
    status: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    userId?: true
    mobileNumber?: true
    mpin?: true
    deviceId?: true
    fcmToken?: true
    roleId?: true
    languageId?: true
    stateId?: true
    isVerified?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    userId?: true
    mobileNumber?: true
    mpin?: true
    deviceId?: true
    fcmToken?: true
    roleId?: true
    languageId?: true
    stateId?: true
    isVerified?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    userId?: true
    mobileNumber?: true
    mpin?: true
    deviceId?: true
    fcmToken?: true
    roleId?: true
    languageId?: true
    stateId?: true
    isVerified?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    userId: string
    mobileNumber: string
    mpin: string
    deviceId: string | null
    fcmToken: string | null
    roleId: string
    languageId: string | null
    stateId: string | null
    isVerified: boolean
    status: string
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    mobileNumber?: boolean
    mpin?: boolean
    deviceId?: boolean
    fcmToken?: boolean
    roleId?: boolean
    languageId?: boolean
    stateId?: boolean
    isVerified?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    role?: boolean | RoleDefaultArgs<ExtArgs>
    language?: boolean | User$languageArgs<ExtArgs>
    state?: boolean | User$stateArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    mobileNumber?: boolean
    mpin?: boolean
    deviceId?: boolean
    fcmToken?: boolean
    roleId?: boolean
    languageId?: boolean
    stateId?: boolean
    isVerified?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    role?: boolean | RoleDefaultArgs<ExtArgs>
    language?: boolean | User$languageArgs<ExtArgs>
    state?: boolean | User$stateArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    mobileNumber?: boolean
    mpin?: boolean
    deviceId?: boolean
    fcmToken?: boolean
    roleId?: boolean
    languageId?: boolean
    stateId?: boolean
    isVerified?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    role?: boolean | RoleDefaultArgs<ExtArgs>
    language?: boolean | User$languageArgs<ExtArgs>
    state?: boolean | User$stateArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    userId?: boolean
    mobileNumber?: boolean
    mpin?: boolean
    deviceId?: boolean
    fcmToken?: boolean
    roleId?: boolean
    languageId?: boolean
    stateId?: boolean
    isVerified?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"userId" | "mobileNumber" | "mpin" | "deviceId" | "fcmToken" | "roleId" | "languageId" | "stateId" | "isVerified" | "status" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    role?: boolean | RoleDefaultArgs<ExtArgs>
    language?: boolean | User$languageArgs<ExtArgs>
    state?: boolean | User$stateArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    role?: boolean | RoleDefaultArgs<ExtArgs>
    language?: boolean | User$languageArgs<ExtArgs>
    state?: boolean | User$stateArgs<ExtArgs>
  }
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    role?: boolean | RoleDefaultArgs<ExtArgs>
    language?: boolean | User$languageArgs<ExtArgs>
    state?: boolean | User$stateArgs<ExtArgs>
  }

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      role: Prisma.$RolePayload<ExtArgs>
      language: Prisma.$LanguagePayload<ExtArgs> | null
      state: Prisma.$StatePayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      userId: string
      mobileNumber: string
      mpin: string
      deviceId: string | null
      fcmToken: string | null
      roleId: string
      languageId: string | null
      stateId: string | null
      isVerified: boolean
      status: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `userId`
     * const userWithUserIdOnly = await prisma.user.findMany({ select: { userId: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `userId`
     * const userWithUserIdOnly = await prisma.user.createManyAndReturn({
     *   select: { userId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `userId`
     * const userWithUserIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { userId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    role<T extends RoleDefaultArgs<ExtArgs> = {}>(args?: Subset<T, RoleDefaultArgs<ExtArgs>>): Prisma__RoleClient<$Result.GetResult<Prisma.$RolePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    language<T extends User$languageArgs<ExtArgs> = {}>(args?: Subset<T, User$languageArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    state<T extends User$stateArgs<ExtArgs> = {}>(args?: Subset<T, User$stateArgs<ExtArgs>>): Prisma__StateClient<$Result.GetResult<Prisma.$StatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly userId: FieldRef<"User", 'String'>
    readonly mobileNumber: FieldRef<"User", 'String'>
    readonly mpin: FieldRef<"User", 'String'>
    readonly deviceId: FieldRef<"User", 'String'>
    readonly fcmToken: FieldRef<"User", 'String'>
    readonly roleId: FieldRef<"User", 'String'>
    readonly languageId: FieldRef<"User", 'String'>
    readonly stateId: FieldRef<"User", 'String'>
    readonly isVerified: FieldRef<"User", 'Boolean'>
    readonly status: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.language
   */
  export type User$languageArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Language
     */
    select?: LanguageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Language
     */
    omit?: LanguageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LanguageInclude<ExtArgs> | null
    where?: LanguageWhereInput
  }

  /**
   * User.state
   */
  export type User$stateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the State
     */
    select?: StateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the State
     */
    omit?: StateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StateInclude<ExtArgs> | null
    where?: StateWhereInput
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Category
   */

  export type AggregateCategory = {
    _count: CategoryCountAggregateOutputType | null
    _min: CategoryMinAggregateOutputType | null
    _max: CategoryMaxAggregateOutputType | null
  }

  export type CategoryMinAggregateOutputType = {
    categoryId: string | null
    key: string | null
    iconUrl: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CategoryMaxAggregateOutputType = {
    categoryId: string | null
    key: string | null
    iconUrl: string | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CategoryCountAggregateOutputType = {
    categoryId: number
    key: number
    iconUrl: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CategoryMinAggregateInputType = {
    categoryId?: true
    key?: true
    iconUrl?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CategoryMaxAggregateInputType = {
    categoryId?: true
    key?: true
    iconUrl?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CategoryCountAggregateInputType = {
    categoryId?: true
    key?: true
    iconUrl?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CategoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Category to aggregate.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Categories
    **/
    _count?: true | CategoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CategoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CategoryMaxAggregateInputType
  }

  export type GetCategoryAggregateType<T extends CategoryAggregateArgs> = {
        [P in keyof T & keyof AggregateCategory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCategory[P]>
      : GetScalarType<T[P], AggregateCategory[P]>
  }




  export type CategoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CategoryWhereInput
    orderBy?: CategoryOrderByWithAggregationInput | CategoryOrderByWithAggregationInput[]
    by: CategoryScalarFieldEnum[] | CategoryScalarFieldEnum
    having?: CategoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CategoryCountAggregateInputType | true
    _min?: CategoryMinAggregateInputType
    _max?: CategoryMaxAggregateInputType
  }

  export type CategoryGroupByOutputType = {
    categoryId: string
    key: string
    iconUrl: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: CategoryCountAggregateOutputType | null
    _min: CategoryMinAggregateOutputType | null
    _max: CategoryMaxAggregateOutputType | null
  }

  type GetCategoryGroupByPayload<T extends CategoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CategoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CategoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CategoryGroupByOutputType[P]>
            : GetScalarType<T[P], CategoryGroupByOutputType[P]>
        }
      >
    >


  export type CategorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    categoryId?: boolean
    key?: boolean
    iconUrl?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    translations?: boolean | Category$translationsArgs<ExtArgs>
    _count?: boolean | CategoryCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["category"]>

  export type CategorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    categoryId?: boolean
    key?: boolean
    iconUrl?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["category"]>

  export type CategorySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    categoryId?: boolean
    key?: boolean
    iconUrl?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["category"]>

  export type CategorySelectScalar = {
    categoryId?: boolean
    key?: boolean
    iconUrl?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CategoryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"categoryId" | "key" | "iconUrl" | "isActive" | "createdAt" | "updatedAt", ExtArgs["result"]["category"]>
  export type CategoryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    translations?: boolean | Category$translationsArgs<ExtArgs>
    _count?: boolean | CategoryCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CategoryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type CategoryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $CategoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Category"
    objects: {
      translations: Prisma.$CategoryTranslationPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      categoryId: string
      key: string
      iconUrl: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["category"]>
    composites: {}
  }

  type CategoryGetPayload<S extends boolean | null | undefined | CategoryDefaultArgs> = $Result.GetResult<Prisma.$CategoryPayload, S>

  type CategoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CategoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CategoryCountAggregateInputType | true
    }

  export interface CategoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Category'], meta: { name: 'Category' } }
    /**
     * Find zero or one Category that matches the filter.
     * @param {CategoryFindUniqueArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CategoryFindUniqueArgs>(args: SelectSubset<T, CategoryFindUniqueArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Category that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CategoryFindUniqueOrThrowArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CategoryFindUniqueOrThrowArgs>(args: SelectSubset<T, CategoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Category that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindFirstArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CategoryFindFirstArgs>(args?: SelectSubset<T, CategoryFindFirstArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Category that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindFirstOrThrowArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CategoryFindFirstOrThrowArgs>(args?: SelectSubset<T, CategoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Categories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Categories
     * const categories = await prisma.category.findMany()
     * 
     * // Get first 10 Categories
     * const categories = await prisma.category.findMany({ take: 10 })
     * 
     * // Only select the `categoryId`
     * const categoryWithCategoryIdOnly = await prisma.category.findMany({ select: { categoryId: true } })
     * 
     */
    findMany<T extends CategoryFindManyArgs>(args?: SelectSubset<T, CategoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Category.
     * @param {CategoryCreateArgs} args - Arguments to create a Category.
     * @example
     * // Create one Category
     * const Category = await prisma.category.create({
     *   data: {
     *     // ... data to create a Category
     *   }
     * })
     * 
     */
    create<T extends CategoryCreateArgs>(args: SelectSubset<T, CategoryCreateArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Categories.
     * @param {CategoryCreateManyArgs} args - Arguments to create many Categories.
     * @example
     * // Create many Categories
     * const category = await prisma.category.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CategoryCreateManyArgs>(args?: SelectSubset<T, CategoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Categories and returns the data saved in the database.
     * @param {CategoryCreateManyAndReturnArgs} args - Arguments to create many Categories.
     * @example
     * // Create many Categories
     * const category = await prisma.category.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Categories and only return the `categoryId`
     * const categoryWithCategoryIdOnly = await prisma.category.createManyAndReturn({
     *   select: { categoryId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CategoryCreateManyAndReturnArgs>(args?: SelectSubset<T, CategoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Category.
     * @param {CategoryDeleteArgs} args - Arguments to delete one Category.
     * @example
     * // Delete one Category
     * const Category = await prisma.category.delete({
     *   where: {
     *     // ... filter to delete one Category
     *   }
     * })
     * 
     */
    delete<T extends CategoryDeleteArgs>(args: SelectSubset<T, CategoryDeleteArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Category.
     * @param {CategoryUpdateArgs} args - Arguments to update one Category.
     * @example
     * // Update one Category
     * const category = await prisma.category.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CategoryUpdateArgs>(args: SelectSubset<T, CategoryUpdateArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Categories.
     * @param {CategoryDeleteManyArgs} args - Arguments to filter Categories to delete.
     * @example
     * // Delete a few Categories
     * const { count } = await prisma.category.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CategoryDeleteManyArgs>(args?: SelectSubset<T, CategoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Categories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Categories
     * const category = await prisma.category.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CategoryUpdateManyArgs>(args: SelectSubset<T, CategoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Categories and returns the data updated in the database.
     * @param {CategoryUpdateManyAndReturnArgs} args - Arguments to update many Categories.
     * @example
     * // Update many Categories
     * const category = await prisma.category.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Categories and only return the `categoryId`
     * const categoryWithCategoryIdOnly = await prisma.category.updateManyAndReturn({
     *   select: { categoryId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CategoryUpdateManyAndReturnArgs>(args: SelectSubset<T, CategoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Category.
     * @param {CategoryUpsertArgs} args - Arguments to update or create a Category.
     * @example
     * // Update or create a Category
     * const category = await prisma.category.upsert({
     *   create: {
     *     // ... data to create a Category
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Category we want to update
     *   }
     * })
     */
    upsert<T extends CategoryUpsertArgs>(args: SelectSubset<T, CategoryUpsertArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Categories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryCountArgs} args - Arguments to filter Categories to count.
     * @example
     * // Count the number of Categories
     * const count = await prisma.category.count({
     *   where: {
     *     // ... the filter for the Categories we want to count
     *   }
     * })
    **/
    count<T extends CategoryCountArgs>(
      args?: Subset<T, CategoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CategoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Category.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CategoryAggregateArgs>(args: Subset<T, CategoryAggregateArgs>): Prisma.PrismaPromise<GetCategoryAggregateType<T>>

    /**
     * Group by Category.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CategoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CategoryGroupByArgs['orderBy'] }
        : { orderBy?: CategoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CategoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCategoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Category model
   */
  readonly fields: CategoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Category.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CategoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    translations<T extends Category$translationsArgs<ExtArgs> = {}>(args?: Subset<T, Category$translationsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Category model
   */
  interface CategoryFieldRefs {
    readonly categoryId: FieldRef<"Category", 'String'>
    readonly key: FieldRef<"Category", 'String'>
    readonly iconUrl: FieldRef<"Category", 'String'>
    readonly isActive: FieldRef<"Category", 'Boolean'>
    readonly createdAt: FieldRef<"Category", 'DateTime'>
    readonly updatedAt: FieldRef<"Category", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Category findUnique
   */
  export type CategoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category findUniqueOrThrow
   */
  export type CategoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category findFirst
   */
  export type CategoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Categories.
     */
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category findFirstOrThrow
   */
  export type CategoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Categories.
     */
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category findMany
   */
  export type CategoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Categories to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category create
   */
  export type CategoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The data needed to create a Category.
     */
    data: XOR<CategoryCreateInput, CategoryUncheckedCreateInput>
  }

  /**
   * Category createMany
   */
  export type CategoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Categories.
     */
    data: CategoryCreateManyInput | CategoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Category createManyAndReturn
   */
  export type CategoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * The data used to create many Categories.
     */
    data: CategoryCreateManyInput | CategoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Category update
   */
  export type CategoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The data needed to update a Category.
     */
    data: XOR<CategoryUpdateInput, CategoryUncheckedUpdateInput>
    /**
     * Choose, which Category to update.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category updateMany
   */
  export type CategoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Categories.
     */
    data: XOR<CategoryUpdateManyMutationInput, CategoryUncheckedUpdateManyInput>
    /**
     * Filter which Categories to update
     */
    where?: CategoryWhereInput
    /**
     * Limit how many Categories to update.
     */
    limit?: number
  }

  /**
   * Category updateManyAndReturn
   */
  export type CategoryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * The data used to update Categories.
     */
    data: XOR<CategoryUpdateManyMutationInput, CategoryUncheckedUpdateManyInput>
    /**
     * Filter which Categories to update
     */
    where?: CategoryWhereInput
    /**
     * Limit how many Categories to update.
     */
    limit?: number
  }

  /**
   * Category upsert
   */
  export type CategoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The filter to search for the Category to update in case it exists.
     */
    where: CategoryWhereUniqueInput
    /**
     * In case the Category found by the `where` argument doesn't exist, create a new Category with this data.
     */
    create: XOR<CategoryCreateInput, CategoryUncheckedCreateInput>
    /**
     * In case the Category was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CategoryUpdateInput, CategoryUncheckedUpdateInput>
  }

  /**
   * Category delete
   */
  export type CategoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter which Category to delete.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category deleteMany
   */
  export type CategoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Categories to delete
     */
    where?: CategoryWhereInput
    /**
     * Limit how many Categories to delete.
     */
    limit?: number
  }

  /**
   * Category.translations
   */
  export type Category$translationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    where?: CategoryTranslationWhereInput
    orderBy?: CategoryTranslationOrderByWithRelationInput | CategoryTranslationOrderByWithRelationInput[]
    cursor?: CategoryTranslationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CategoryTranslationScalarFieldEnum | CategoryTranslationScalarFieldEnum[]
  }

  /**
   * Category without action
   */
  export type CategoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
  }


  /**
   * Model CategoryTranslation
   */

  export type AggregateCategoryTranslation = {
    _count: CategoryTranslationCountAggregateOutputType | null
    _min: CategoryTranslationMinAggregateOutputType | null
    _max: CategoryTranslationMaxAggregateOutputType | null
  }

  export type CategoryTranslationMinAggregateOutputType = {
    translationId: string | null
    categoryId: string | null
    languageId: string | null
    displayName: string | null
    createdAt: Date | null
  }

  export type CategoryTranslationMaxAggregateOutputType = {
    translationId: string | null
    categoryId: string | null
    languageId: string | null
    displayName: string | null
    createdAt: Date | null
  }

  export type CategoryTranslationCountAggregateOutputType = {
    translationId: number
    categoryId: number
    languageId: number
    displayName: number
    createdAt: number
    _all: number
  }


  export type CategoryTranslationMinAggregateInputType = {
    translationId?: true
    categoryId?: true
    languageId?: true
    displayName?: true
    createdAt?: true
  }

  export type CategoryTranslationMaxAggregateInputType = {
    translationId?: true
    categoryId?: true
    languageId?: true
    displayName?: true
    createdAt?: true
  }

  export type CategoryTranslationCountAggregateInputType = {
    translationId?: true
    categoryId?: true
    languageId?: true
    displayName?: true
    createdAt?: true
    _all?: true
  }

  export type CategoryTranslationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CategoryTranslation to aggregate.
     */
    where?: CategoryTranslationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CategoryTranslations to fetch.
     */
    orderBy?: CategoryTranslationOrderByWithRelationInput | CategoryTranslationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CategoryTranslationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CategoryTranslations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CategoryTranslations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CategoryTranslations
    **/
    _count?: true | CategoryTranslationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CategoryTranslationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CategoryTranslationMaxAggregateInputType
  }

  export type GetCategoryTranslationAggregateType<T extends CategoryTranslationAggregateArgs> = {
        [P in keyof T & keyof AggregateCategoryTranslation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCategoryTranslation[P]>
      : GetScalarType<T[P], AggregateCategoryTranslation[P]>
  }




  export type CategoryTranslationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CategoryTranslationWhereInput
    orderBy?: CategoryTranslationOrderByWithAggregationInput | CategoryTranslationOrderByWithAggregationInput[]
    by: CategoryTranslationScalarFieldEnum[] | CategoryTranslationScalarFieldEnum
    having?: CategoryTranslationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CategoryTranslationCountAggregateInputType | true
    _min?: CategoryTranslationMinAggregateInputType
    _max?: CategoryTranslationMaxAggregateInputType
  }

  export type CategoryTranslationGroupByOutputType = {
    translationId: string
    categoryId: string
    languageId: string
    displayName: string
    createdAt: Date
    _count: CategoryTranslationCountAggregateOutputType | null
    _min: CategoryTranslationMinAggregateOutputType | null
    _max: CategoryTranslationMaxAggregateOutputType | null
  }

  type GetCategoryTranslationGroupByPayload<T extends CategoryTranslationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CategoryTranslationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CategoryTranslationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CategoryTranslationGroupByOutputType[P]>
            : GetScalarType<T[P], CategoryTranslationGroupByOutputType[P]>
        }
      >
    >


  export type CategoryTranslationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    translationId?: boolean
    categoryId?: boolean
    languageId?: boolean
    displayName?: boolean
    createdAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["categoryTranslation"]>

  export type CategoryTranslationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    translationId?: boolean
    categoryId?: boolean
    languageId?: boolean
    displayName?: boolean
    createdAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["categoryTranslation"]>

  export type CategoryTranslationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    translationId?: boolean
    categoryId?: boolean
    languageId?: boolean
    displayName?: boolean
    createdAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["categoryTranslation"]>

  export type CategoryTranslationSelectScalar = {
    translationId?: boolean
    categoryId?: boolean
    languageId?: boolean
    displayName?: boolean
    createdAt?: boolean
  }

  export type CategoryTranslationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"translationId" | "categoryId" | "languageId" | "displayName" | "createdAt", ExtArgs["result"]["categoryTranslation"]>
  export type CategoryTranslationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }
  export type CategoryTranslationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }
  export type CategoryTranslationIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
    language?: boolean | LanguageDefaultArgs<ExtArgs>
  }

  export type $CategoryTranslationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CategoryTranslation"
    objects: {
      category: Prisma.$CategoryPayload<ExtArgs>
      language: Prisma.$LanguagePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      translationId: string
      categoryId: string
      languageId: string
      displayName: string
      createdAt: Date
    }, ExtArgs["result"]["categoryTranslation"]>
    composites: {}
  }

  type CategoryTranslationGetPayload<S extends boolean | null | undefined | CategoryTranslationDefaultArgs> = $Result.GetResult<Prisma.$CategoryTranslationPayload, S>

  type CategoryTranslationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CategoryTranslationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CategoryTranslationCountAggregateInputType | true
    }

  export interface CategoryTranslationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CategoryTranslation'], meta: { name: 'CategoryTranslation' } }
    /**
     * Find zero or one CategoryTranslation that matches the filter.
     * @param {CategoryTranslationFindUniqueArgs} args - Arguments to find a CategoryTranslation
     * @example
     * // Get one CategoryTranslation
     * const categoryTranslation = await prisma.categoryTranslation.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CategoryTranslationFindUniqueArgs>(args: SelectSubset<T, CategoryTranslationFindUniqueArgs<ExtArgs>>): Prisma__CategoryTranslationClient<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CategoryTranslation that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CategoryTranslationFindUniqueOrThrowArgs} args - Arguments to find a CategoryTranslation
     * @example
     * // Get one CategoryTranslation
     * const categoryTranslation = await prisma.categoryTranslation.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CategoryTranslationFindUniqueOrThrowArgs>(args: SelectSubset<T, CategoryTranslationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CategoryTranslationClient<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CategoryTranslation that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryTranslationFindFirstArgs} args - Arguments to find a CategoryTranslation
     * @example
     * // Get one CategoryTranslation
     * const categoryTranslation = await prisma.categoryTranslation.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CategoryTranslationFindFirstArgs>(args?: SelectSubset<T, CategoryTranslationFindFirstArgs<ExtArgs>>): Prisma__CategoryTranslationClient<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CategoryTranslation that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryTranslationFindFirstOrThrowArgs} args - Arguments to find a CategoryTranslation
     * @example
     * // Get one CategoryTranslation
     * const categoryTranslation = await prisma.categoryTranslation.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CategoryTranslationFindFirstOrThrowArgs>(args?: SelectSubset<T, CategoryTranslationFindFirstOrThrowArgs<ExtArgs>>): Prisma__CategoryTranslationClient<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CategoryTranslations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryTranslationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CategoryTranslations
     * const categoryTranslations = await prisma.categoryTranslation.findMany()
     * 
     * // Get first 10 CategoryTranslations
     * const categoryTranslations = await prisma.categoryTranslation.findMany({ take: 10 })
     * 
     * // Only select the `translationId`
     * const categoryTranslationWithTranslationIdOnly = await prisma.categoryTranslation.findMany({ select: { translationId: true } })
     * 
     */
    findMany<T extends CategoryTranslationFindManyArgs>(args?: SelectSubset<T, CategoryTranslationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CategoryTranslation.
     * @param {CategoryTranslationCreateArgs} args - Arguments to create a CategoryTranslation.
     * @example
     * // Create one CategoryTranslation
     * const CategoryTranslation = await prisma.categoryTranslation.create({
     *   data: {
     *     // ... data to create a CategoryTranslation
     *   }
     * })
     * 
     */
    create<T extends CategoryTranslationCreateArgs>(args: SelectSubset<T, CategoryTranslationCreateArgs<ExtArgs>>): Prisma__CategoryTranslationClient<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CategoryTranslations.
     * @param {CategoryTranslationCreateManyArgs} args - Arguments to create many CategoryTranslations.
     * @example
     * // Create many CategoryTranslations
     * const categoryTranslation = await prisma.categoryTranslation.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CategoryTranslationCreateManyArgs>(args?: SelectSubset<T, CategoryTranslationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CategoryTranslations and returns the data saved in the database.
     * @param {CategoryTranslationCreateManyAndReturnArgs} args - Arguments to create many CategoryTranslations.
     * @example
     * // Create many CategoryTranslations
     * const categoryTranslation = await prisma.categoryTranslation.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CategoryTranslations and only return the `translationId`
     * const categoryTranslationWithTranslationIdOnly = await prisma.categoryTranslation.createManyAndReturn({
     *   select: { translationId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CategoryTranslationCreateManyAndReturnArgs>(args?: SelectSubset<T, CategoryTranslationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CategoryTranslation.
     * @param {CategoryTranslationDeleteArgs} args - Arguments to delete one CategoryTranslation.
     * @example
     * // Delete one CategoryTranslation
     * const CategoryTranslation = await prisma.categoryTranslation.delete({
     *   where: {
     *     // ... filter to delete one CategoryTranslation
     *   }
     * })
     * 
     */
    delete<T extends CategoryTranslationDeleteArgs>(args: SelectSubset<T, CategoryTranslationDeleteArgs<ExtArgs>>): Prisma__CategoryTranslationClient<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CategoryTranslation.
     * @param {CategoryTranslationUpdateArgs} args - Arguments to update one CategoryTranslation.
     * @example
     * // Update one CategoryTranslation
     * const categoryTranslation = await prisma.categoryTranslation.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CategoryTranslationUpdateArgs>(args: SelectSubset<T, CategoryTranslationUpdateArgs<ExtArgs>>): Prisma__CategoryTranslationClient<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CategoryTranslations.
     * @param {CategoryTranslationDeleteManyArgs} args - Arguments to filter CategoryTranslations to delete.
     * @example
     * // Delete a few CategoryTranslations
     * const { count } = await prisma.categoryTranslation.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CategoryTranslationDeleteManyArgs>(args?: SelectSubset<T, CategoryTranslationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CategoryTranslations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryTranslationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CategoryTranslations
     * const categoryTranslation = await prisma.categoryTranslation.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CategoryTranslationUpdateManyArgs>(args: SelectSubset<T, CategoryTranslationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CategoryTranslations and returns the data updated in the database.
     * @param {CategoryTranslationUpdateManyAndReturnArgs} args - Arguments to update many CategoryTranslations.
     * @example
     * // Update many CategoryTranslations
     * const categoryTranslation = await prisma.categoryTranslation.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CategoryTranslations and only return the `translationId`
     * const categoryTranslationWithTranslationIdOnly = await prisma.categoryTranslation.updateManyAndReturn({
     *   select: { translationId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CategoryTranslationUpdateManyAndReturnArgs>(args: SelectSubset<T, CategoryTranslationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CategoryTranslation.
     * @param {CategoryTranslationUpsertArgs} args - Arguments to update or create a CategoryTranslation.
     * @example
     * // Update or create a CategoryTranslation
     * const categoryTranslation = await prisma.categoryTranslation.upsert({
     *   create: {
     *     // ... data to create a CategoryTranslation
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CategoryTranslation we want to update
     *   }
     * })
     */
    upsert<T extends CategoryTranslationUpsertArgs>(args: SelectSubset<T, CategoryTranslationUpsertArgs<ExtArgs>>): Prisma__CategoryTranslationClient<$Result.GetResult<Prisma.$CategoryTranslationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CategoryTranslations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryTranslationCountArgs} args - Arguments to filter CategoryTranslations to count.
     * @example
     * // Count the number of CategoryTranslations
     * const count = await prisma.categoryTranslation.count({
     *   where: {
     *     // ... the filter for the CategoryTranslations we want to count
     *   }
     * })
    **/
    count<T extends CategoryTranslationCountArgs>(
      args?: Subset<T, CategoryTranslationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CategoryTranslationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CategoryTranslation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryTranslationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CategoryTranslationAggregateArgs>(args: Subset<T, CategoryTranslationAggregateArgs>): Prisma.PrismaPromise<GetCategoryTranslationAggregateType<T>>

    /**
     * Group by CategoryTranslation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryTranslationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CategoryTranslationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CategoryTranslationGroupByArgs['orderBy'] }
        : { orderBy?: CategoryTranslationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CategoryTranslationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCategoryTranslationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CategoryTranslation model
   */
  readonly fields: CategoryTranslationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CategoryTranslation.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CategoryTranslationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    category<T extends CategoryDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CategoryDefaultArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    language<T extends LanguageDefaultArgs<ExtArgs> = {}>(args?: Subset<T, LanguageDefaultArgs<ExtArgs>>): Prisma__LanguageClient<$Result.GetResult<Prisma.$LanguagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CategoryTranslation model
   */
  interface CategoryTranslationFieldRefs {
    readonly translationId: FieldRef<"CategoryTranslation", 'String'>
    readonly categoryId: FieldRef<"CategoryTranslation", 'String'>
    readonly languageId: FieldRef<"CategoryTranslation", 'String'>
    readonly displayName: FieldRef<"CategoryTranslation", 'String'>
    readonly createdAt: FieldRef<"CategoryTranslation", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CategoryTranslation findUnique
   */
  export type CategoryTranslationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * Filter, which CategoryTranslation to fetch.
     */
    where: CategoryTranslationWhereUniqueInput
  }

  /**
   * CategoryTranslation findUniqueOrThrow
   */
  export type CategoryTranslationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * Filter, which CategoryTranslation to fetch.
     */
    where: CategoryTranslationWhereUniqueInput
  }

  /**
   * CategoryTranslation findFirst
   */
  export type CategoryTranslationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * Filter, which CategoryTranslation to fetch.
     */
    where?: CategoryTranslationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CategoryTranslations to fetch.
     */
    orderBy?: CategoryTranslationOrderByWithRelationInput | CategoryTranslationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CategoryTranslations.
     */
    cursor?: CategoryTranslationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CategoryTranslations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CategoryTranslations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CategoryTranslations.
     */
    distinct?: CategoryTranslationScalarFieldEnum | CategoryTranslationScalarFieldEnum[]
  }

  /**
   * CategoryTranslation findFirstOrThrow
   */
  export type CategoryTranslationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * Filter, which CategoryTranslation to fetch.
     */
    where?: CategoryTranslationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CategoryTranslations to fetch.
     */
    orderBy?: CategoryTranslationOrderByWithRelationInput | CategoryTranslationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CategoryTranslations.
     */
    cursor?: CategoryTranslationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CategoryTranslations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CategoryTranslations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CategoryTranslations.
     */
    distinct?: CategoryTranslationScalarFieldEnum | CategoryTranslationScalarFieldEnum[]
  }

  /**
   * CategoryTranslation findMany
   */
  export type CategoryTranslationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * Filter, which CategoryTranslations to fetch.
     */
    where?: CategoryTranslationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CategoryTranslations to fetch.
     */
    orderBy?: CategoryTranslationOrderByWithRelationInput | CategoryTranslationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CategoryTranslations.
     */
    cursor?: CategoryTranslationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CategoryTranslations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CategoryTranslations.
     */
    skip?: number
    distinct?: CategoryTranslationScalarFieldEnum | CategoryTranslationScalarFieldEnum[]
  }

  /**
   * CategoryTranslation create
   */
  export type CategoryTranslationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * The data needed to create a CategoryTranslation.
     */
    data: XOR<CategoryTranslationCreateInput, CategoryTranslationUncheckedCreateInput>
  }

  /**
   * CategoryTranslation createMany
   */
  export type CategoryTranslationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CategoryTranslations.
     */
    data: CategoryTranslationCreateManyInput | CategoryTranslationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CategoryTranslation createManyAndReturn
   */
  export type CategoryTranslationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * The data used to create many CategoryTranslations.
     */
    data: CategoryTranslationCreateManyInput | CategoryTranslationCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CategoryTranslation update
   */
  export type CategoryTranslationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * The data needed to update a CategoryTranslation.
     */
    data: XOR<CategoryTranslationUpdateInput, CategoryTranslationUncheckedUpdateInput>
    /**
     * Choose, which CategoryTranslation to update.
     */
    where: CategoryTranslationWhereUniqueInput
  }

  /**
   * CategoryTranslation updateMany
   */
  export type CategoryTranslationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CategoryTranslations.
     */
    data: XOR<CategoryTranslationUpdateManyMutationInput, CategoryTranslationUncheckedUpdateManyInput>
    /**
     * Filter which CategoryTranslations to update
     */
    where?: CategoryTranslationWhereInput
    /**
     * Limit how many CategoryTranslations to update.
     */
    limit?: number
  }

  /**
   * CategoryTranslation updateManyAndReturn
   */
  export type CategoryTranslationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * The data used to update CategoryTranslations.
     */
    data: XOR<CategoryTranslationUpdateManyMutationInput, CategoryTranslationUncheckedUpdateManyInput>
    /**
     * Filter which CategoryTranslations to update
     */
    where?: CategoryTranslationWhereInput
    /**
     * Limit how many CategoryTranslations to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CategoryTranslation upsert
   */
  export type CategoryTranslationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * The filter to search for the CategoryTranslation to update in case it exists.
     */
    where: CategoryTranslationWhereUniqueInput
    /**
     * In case the CategoryTranslation found by the `where` argument doesn't exist, create a new CategoryTranslation with this data.
     */
    create: XOR<CategoryTranslationCreateInput, CategoryTranslationUncheckedCreateInput>
    /**
     * In case the CategoryTranslation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CategoryTranslationUpdateInput, CategoryTranslationUncheckedUpdateInput>
  }

  /**
   * CategoryTranslation delete
   */
  export type CategoryTranslationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
    /**
     * Filter which CategoryTranslation to delete.
     */
    where: CategoryTranslationWhereUniqueInput
  }

  /**
   * CategoryTranslation deleteMany
   */
  export type CategoryTranslationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CategoryTranslations to delete
     */
    where?: CategoryTranslationWhereInput
    /**
     * Limit how many CategoryTranslations to delete.
     */
    limit?: number
  }

  /**
   * CategoryTranslation without action
   */
  export type CategoryTranslationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryTranslation
     */
    select?: CategoryTranslationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CategoryTranslation
     */
    omit?: CategoryTranslationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryTranslationInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const LanguageScalarFieldEnum: {
    languageId: 'languageId',
    name: 'name',
    code: 'code',
    isRTL: 'isRTL',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type LanguageScalarFieldEnum = (typeof LanguageScalarFieldEnum)[keyof typeof LanguageScalarFieldEnum]


  export const StateScalarFieldEnum: {
    stateId: 'stateId',
    name: 'name',
    languageId: 'languageId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type StateScalarFieldEnum = (typeof StateScalarFieldEnum)[keyof typeof StateScalarFieldEnum]


  export const RoleScalarFieldEnum: {
    roleId: 'roleId',
    name: 'name',
    permissions: 'permissions',
    createdAt: 'createdAt'
  };

  export type RoleScalarFieldEnum = (typeof RoleScalarFieldEnum)[keyof typeof RoleScalarFieldEnum]


  export const UserScalarFieldEnum: {
    userId: 'userId',
    mobileNumber: 'mobileNumber',
    mpin: 'mpin',
    deviceId: 'deviceId',
    fcmToken: 'fcmToken',
    roleId: 'roleId',
    languageId: 'languageId',
    stateId: 'stateId',
    isVerified: 'isVerified',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const CategoryScalarFieldEnum: {
    categoryId: 'categoryId',
    key: 'key',
    iconUrl: 'iconUrl',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CategoryScalarFieldEnum = (typeof CategoryScalarFieldEnum)[keyof typeof CategoryScalarFieldEnum]


  export const CategoryTranslationScalarFieldEnum: {
    translationId: 'translationId',
    categoryId: 'categoryId',
    languageId: 'languageId',
    displayName: 'displayName',
    createdAt: 'createdAt'
  };

  export type CategoryTranslationScalarFieldEnum = (typeof CategoryTranslationScalarFieldEnum)[keyof typeof CategoryTranslationScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'RoleName'
   */
  export type EnumRoleNameFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RoleName'>
    


  /**
   * Reference to a field of type 'RoleName[]'
   */
  export type ListEnumRoleNameFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RoleName[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type LanguageWhereInput = {
    AND?: LanguageWhereInput | LanguageWhereInput[]
    OR?: LanguageWhereInput[]
    NOT?: LanguageWhereInput | LanguageWhereInput[]
    languageId?: StringFilter<"Language"> | string
    name?: StringFilter<"Language"> | string
    code?: StringFilter<"Language"> | string
    isRTL?: BoolFilter<"Language"> | boolean
    createdAt?: DateTimeFilter<"Language"> | Date | string
    updatedAt?: DateTimeFilter<"Language"> | Date | string
    states?: StateListRelationFilter
    users?: UserListRelationFilter
    CategoryTranslation?: CategoryTranslationListRelationFilter
  }

  export type LanguageOrderByWithRelationInput = {
    languageId?: SortOrder
    name?: SortOrder
    code?: SortOrder
    isRTL?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    states?: StateOrderByRelationAggregateInput
    users?: UserOrderByRelationAggregateInput
    CategoryTranslation?: CategoryTranslationOrderByRelationAggregateInput
  }

  export type LanguageWhereUniqueInput = Prisma.AtLeast<{
    languageId?: string
    code?: string
    AND?: LanguageWhereInput | LanguageWhereInput[]
    OR?: LanguageWhereInput[]
    NOT?: LanguageWhereInput | LanguageWhereInput[]
    name?: StringFilter<"Language"> | string
    isRTL?: BoolFilter<"Language"> | boolean
    createdAt?: DateTimeFilter<"Language"> | Date | string
    updatedAt?: DateTimeFilter<"Language"> | Date | string
    states?: StateListRelationFilter
    users?: UserListRelationFilter
    CategoryTranslation?: CategoryTranslationListRelationFilter
  }, "languageId" | "code">

  export type LanguageOrderByWithAggregationInput = {
    languageId?: SortOrder
    name?: SortOrder
    code?: SortOrder
    isRTL?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: LanguageCountOrderByAggregateInput
    _max?: LanguageMaxOrderByAggregateInput
    _min?: LanguageMinOrderByAggregateInput
  }

  export type LanguageScalarWhereWithAggregatesInput = {
    AND?: LanguageScalarWhereWithAggregatesInput | LanguageScalarWhereWithAggregatesInput[]
    OR?: LanguageScalarWhereWithAggregatesInput[]
    NOT?: LanguageScalarWhereWithAggregatesInput | LanguageScalarWhereWithAggregatesInput[]
    languageId?: StringWithAggregatesFilter<"Language"> | string
    name?: StringWithAggregatesFilter<"Language"> | string
    code?: StringWithAggregatesFilter<"Language"> | string
    isRTL?: BoolWithAggregatesFilter<"Language"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Language"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Language"> | Date | string
  }

  export type StateWhereInput = {
    AND?: StateWhereInput | StateWhereInput[]
    OR?: StateWhereInput[]
    NOT?: StateWhereInput | StateWhereInput[]
    stateId?: StringFilter<"State"> | string
    name?: StringFilter<"State"> | string
    languageId?: StringFilter<"State"> | string
    createdAt?: DateTimeFilter<"State"> | Date | string
    updatedAt?: DateTimeFilter<"State"> | Date | string
    language?: XOR<LanguageScalarRelationFilter, LanguageWhereInput>
    users?: UserListRelationFilter
  }

  export type StateOrderByWithRelationInput = {
    stateId?: SortOrder
    name?: SortOrder
    languageId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    language?: LanguageOrderByWithRelationInput
    users?: UserOrderByRelationAggregateInput
  }

  export type StateWhereUniqueInput = Prisma.AtLeast<{
    stateId?: string
    AND?: StateWhereInput | StateWhereInput[]
    OR?: StateWhereInput[]
    NOT?: StateWhereInput | StateWhereInput[]
    name?: StringFilter<"State"> | string
    languageId?: StringFilter<"State"> | string
    createdAt?: DateTimeFilter<"State"> | Date | string
    updatedAt?: DateTimeFilter<"State"> | Date | string
    language?: XOR<LanguageScalarRelationFilter, LanguageWhereInput>
    users?: UserListRelationFilter
  }, "stateId">

  export type StateOrderByWithAggregationInput = {
    stateId?: SortOrder
    name?: SortOrder
    languageId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: StateCountOrderByAggregateInput
    _max?: StateMaxOrderByAggregateInput
    _min?: StateMinOrderByAggregateInput
  }

  export type StateScalarWhereWithAggregatesInput = {
    AND?: StateScalarWhereWithAggregatesInput | StateScalarWhereWithAggregatesInput[]
    OR?: StateScalarWhereWithAggregatesInput[]
    NOT?: StateScalarWhereWithAggregatesInput | StateScalarWhereWithAggregatesInput[]
    stateId?: StringWithAggregatesFilter<"State"> | string
    name?: StringWithAggregatesFilter<"State"> | string
    languageId?: StringWithAggregatesFilter<"State"> | string
    createdAt?: DateTimeWithAggregatesFilter<"State"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"State"> | Date | string
  }

  export type RoleWhereInput = {
    AND?: RoleWhereInput | RoleWhereInput[]
    OR?: RoleWhereInput[]
    NOT?: RoleWhereInput | RoleWhereInput[]
    roleId?: StringFilter<"Role"> | string
    name?: EnumRoleNameFilter<"Role"> | $Enums.RoleName
    permissions?: JsonFilter<"Role">
    createdAt?: DateTimeFilter<"Role"> | Date | string
    users?: UserListRelationFilter
  }

  export type RoleOrderByWithRelationInput = {
    roleId?: SortOrder
    name?: SortOrder
    permissions?: SortOrder
    createdAt?: SortOrder
    users?: UserOrderByRelationAggregateInput
  }

  export type RoleWhereUniqueInput = Prisma.AtLeast<{
    roleId?: string
    AND?: RoleWhereInput | RoleWhereInput[]
    OR?: RoleWhereInput[]
    NOT?: RoleWhereInput | RoleWhereInput[]
    name?: EnumRoleNameFilter<"Role"> | $Enums.RoleName
    permissions?: JsonFilter<"Role">
    createdAt?: DateTimeFilter<"Role"> | Date | string
    users?: UserListRelationFilter
  }, "roleId">

  export type RoleOrderByWithAggregationInput = {
    roleId?: SortOrder
    name?: SortOrder
    permissions?: SortOrder
    createdAt?: SortOrder
    _count?: RoleCountOrderByAggregateInput
    _max?: RoleMaxOrderByAggregateInput
    _min?: RoleMinOrderByAggregateInput
  }

  export type RoleScalarWhereWithAggregatesInput = {
    AND?: RoleScalarWhereWithAggregatesInput | RoleScalarWhereWithAggregatesInput[]
    OR?: RoleScalarWhereWithAggregatesInput[]
    NOT?: RoleScalarWhereWithAggregatesInput | RoleScalarWhereWithAggregatesInput[]
    roleId?: StringWithAggregatesFilter<"Role"> | string
    name?: EnumRoleNameWithAggregatesFilter<"Role"> | $Enums.RoleName
    permissions?: JsonWithAggregatesFilter<"Role">
    createdAt?: DateTimeWithAggregatesFilter<"Role"> | Date | string
  }

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    userId?: StringFilter<"User"> | string
    mobileNumber?: StringFilter<"User"> | string
    mpin?: StringFilter<"User"> | string
    deviceId?: StringNullableFilter<"User"> | string | null
    fcmToken?: StringNullableFilter<"User"> | string | null
    roleId?: StringFilter<"User"> | string
    languageId?: StringNullableFilter<"User"> | string | null
    stateId?: StringNullableFilter<"User"> | string | null
    isVerified?: BoolFilter<"User"> | boolean
    status?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    role?: XOR<RoleScalarRelationFilter, RoleWhereInput>
    language?: XOR<LanguageNullableScalarRelationFilter, LanguageWhereInput> | null
    state?: XOR<StateNullableScalarRelationFilter, StateWhereInput> | null
  }

  export type UserOrderByWithRelationInput = {
    userId?: SortOrder
    mobileNumber?: SortOrder
    mpin?: SortOrder
    deviceId?: SortOrderInput | SortOrder
    fcmToken?: SortOrderInput | SortOrder
    roleId?: SortOrder
    languageId?: SortOrderInput | SortOrder
    stateId?: SortOrderInput | SortOrder
    isVerified?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    role?: RoleOrderByWithRelationInput
    language?: LanguageOrderByWithRelationInput
    state?: StateOrderByWithRelationInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    userId?: string
    mobileNumber?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    mpin?: StringFilter<"User"> | string
    deviceId?: StringNullableFilter<"User"> | string | null
    fcmToken?: StringNullableFilter<"User"> | string | null
    roleId?: StringFilter<"User"> | string
    languageId?: StringNullableFilter<"User"> | string | null
    stateId?: StringNullableFilter<"User"> | string | null
    isVerified?: BoolFilter<"User"> | boolean
    status?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    role?: XOR<RoleScalarRelationFilter, RoleWhereInput>
    language?: XOR<LanguageNullableScalarRelationFilter, LanguageWhereInput> | null
    state?: XOR<StateNullableScalarRelationFilter, StateWhereInput> | null
  }, "userId" | "mobileNumber">

  export type UserOrderByWithAggregationInput = {
    userId?: SortOrder
    mobileNumber?: SortOrder
    mpin?: SortOrder
    deviceId?: SortOrderInput | SortOrder
    fcmToken?: SortOrderInput | SortOrder
    roleId?: SortOrder
    languageId?: SortOrderInput | SortOrder
    stateId?: SortOrderInput | SortOrder
    isVerified?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    userId?: StringWithAggregatesFilter<"User"> | string
    mobileNumber?: StringWithAggregatesFilter<"User"> | string
    mpin?: StringWithAggregatesFilter<"User"> | string
    deviceId?: StringNullableWithAggregatesFilter<"User"> | string | null
    fcmToken?: StringNullableWithAggregatesFilter<"User"> | string | null
    roleId?: StringWithAggregatesFilter<"User"> | string
    languageId?: StringNullableWithAggregatesFilter<"User"> | string | null
    stateId?: StringNullableWithAggregatesFilter<"User"> | string | null
    isVerified?: BoolWithAggregatesFilter<"User"> | boolean
    status?: StringWithAggregatesFilter<"User"> | string
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type CategoryWhereInput = {
    AND?: CategoryWhereInput | CategoryWhereInput[]
    OR?: CategoryWhereInput[]
    NOT?: CategoryWhereInput | CategoryWhereInput[]
    categoryId?: StringFilter<"Category"> | string
    key?: StringFilter<"Category"> | string
    iconUrl?: StringNullableFilter<"Category"> | string | null
    isActive?: BoolFilter<"Category"> | boolean
    createdAt?: DateTimeFilter<"Category"> | Date | string
    updatedAt?: DateTimeFilter<"Category"> | Date | string
    translations?: CategoryTranslationListRelationFilter
  }

  export type CategoryOrderByWithRelationInput = {
    categoryId?: SortOrder
    key?: SortOrder
    iconUrl?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    translations?: CategoryTranslationOrderByRelationAggregateInput
  }

  export type CategoryWhereUniqueInput = Prisma.AtLeast<{
    categoryId?: string
    key?: string
    AND?: CategoryWhereInput | CategoryWhereInput[]
    OR?: CategoryWhereInput[]
    NOT?: CategoryWhereInput | CategoryWhereInput[]
    iconUrl?: StringNullableFilter<"Category"> | string | null
    isActive?: BoolFilter<"Category"> | boolean
    createdAt?: DateTimeFilter<"Category"> | Date | string
    updatedAt?: DateTimeFilter<"Category"> | Date | string
    translations?: CategoryTranslationListRelationFilter
  }, "categoryId" | "key">

  export type CategoryOrderByWithAggregationInput = {
    categoryId?: SortOrder
    key?: SortOrder
    iconUrl?: SortOrderInput | SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CategoryCountOrderByAggregateInput
    _max?: CategoryMaxOrderByAggregateInput
    _min?: CategoryMinOrderByAggregateInput
  }

  export type CategoryScalarWhereWithAggregatesInput = {
    AND?: CategoryScalarWhereWithAggregatesInput | CategoryScalarWhereWithAggregatesInput[]
    OR?: CategoryScalarWhereWithAggregatesInput[]
    NOT?: CategoryScalarWhereWithAggregatesInput | CategoryScalarWhereWithAggregatesInput[]
    categoryId?: StringWithAggregatesFilter<"Category"> | string
    key?: StringWithAggregatesFilter<"Category"> | string
    iconUrl?: StringNullableWithAggregatesFilter<"Category"> | string | null
    isActive?: BoolWithAggregatesFilter<"Category"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Category"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Category"> | Date | string
  }

  export type CategoryTranslationWhereInput = {
    AND?: CategoryTranslationWhereInput | CategoryTranslationWhereInput[]
    OR?: CategoryTranslationWhereInput[]
    NOT?: CategoryTranslationWhereInput | CategoryTranslationWhereInput[]
    translationId?: StringFilter<"CategoryTranslation"> | string
    categoryId?: StringFilter<"CategoryTranslation"> | string
    languageId?: StringFilter<"CategoryTranslation"> | string
    displayName?: StringFilter<"CategoryTranslation"> | string
    createdAt?: DateTimeFilter<"CategoryTranslation"> | Date | string
    category?: XOR<CategoryScalarRelationFilter, CategoryWhereInput>
    language?: XOR<LanguageScalarRelationFilter, LanguageWhereInput>
  }

  export type CategoryTranslationOrderByWithRelationInput = {
    translationId?: SortOrder
    categoryId?: SortOrder
    languageId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
    category?: CategoryOrderByWithRelationInput
    language?: LanguageOrderByWithRelationInput
  }

  export type CategoryTranslationWhereUniqueInput = Prisma.AtLeast<{
    translationId?: string
    AND?: CategoryTranslationWhereInput | CategoryTranslationWhereInput[]
    OR?: CategoryTranslationWhereInput[]
    NOT?: CategoryTranslationWhereInput | CategoryTranslationWhereInput[]
    categoryId?: StringFilter<"CategoryTranslation"> | string
    languageId?: StringFilter<"CategoryTranslation"> | string
    displayName?: StringFilter<"CategoryTranslation"> | string
    createdAt?: DateTimeFilter<"CategoryTranslation"> | Date | string
    category?: XOR<CategoryScalarRelationFilter, CategoryWhereInput>
    language?: XOR<LanguageScalarRelationFilter, LanguageWhereInput>
  }, "translationId">

  export type CategoryTranslationOrderByWithAggregationInput = {
    translationId?: SortOrder
    categoryId?: SortOrder
    languageId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
    _count?: CategoryTranslationCountOrderByAggregateInput
    _max?: CategoryTranslationMaxOrderByAggregateInput
    _min?: CategoryTranslationMinOrderByAggregateInput
  }

  export type CategoryTranslationScalarWhereWithAggregatesInput = {
    AND?: CategoryTranslationScalarWhereWithAggregatesInput | CategoryTranslationScalarWhereWithAggregatesInput[]
    OR?: CategoryTranslationScalarWhereWithAggregatesInput[]
    NOT?: CategoryTranslationScalarWhereWithAggregatesInput | CategoryTranslationScalarWhereWithAggregatesInput[]
    translationId?: StringWithAggregatesFilter<"CategoryTranslation"> | string
    categoryId?: StringWithAggregatesFilter<"CategoryTranslation"> | string
    languageId?: StringWithAggregatesFilter<"CategoryTranslation"> | string
    displayName?: StringWithAggregatesFilter<"CategoryTranslation"> | string
    createdAt?: DateTimeWithAggregatesFilter<"CategoryTranslation"> | Date | string
  }

  export type LanguageCreateInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    states?: StateCreateNestedManyWithoutLanguageInput
    users?: UserCreateNestedManyWithoutLanguageInput
    CategoryTranslation?: CategoryTranslationCreateNestedManyWithoutLanguageInput
  }

  export type LanguageUncheckedCreateInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    states?: StateUncheckedCreateNestedManyWithoutLanguageInput
    users?: UserUncheckedCreateNestedManyWithoutLanguageInput
    CategoryTranslation?: CategoryTranslationUncheckedCreateNestedManyWithoutLanguageInput
  }

  export type LanguageUpdateInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    states?: StateUpdateManyWithoutLanguageNestedInput
    users?: UserUpdateManyWithoutLanguageNestedInput
    CategoryTranslation?: CategoryTranslationUpdateManyWithoutLanguageNestedInput
  }

  export type LanguageUncheckedUpdateInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    states?: StateUncheckedUpdateManyWithoutLanguageNestedInput
    users?: UserUncheckedUpdateManyWithoutLanguageNestedInput
    CategoryTranslation?: CategoryTranslationUncheckedUpdateManyWithoutLanguageNestedInput
  }

  export type LanguageCreateManyInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LanguageUpdateManyMutationInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LanguageUncheckedUpdateManyInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StateCreateInput = {
    stateId?: string
    name: string
    createdAt?: Date | string
    updatedAt?: Date | string
    language: LanguageCreateNestedOneWithoutStatesInput
    users?: UserCreateNestedManyWithoutStateInput
  }

  export type StateUncheckedCreateInput = {
    stateId?: string
    name: string
    languageId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    users?: UserUncheckedCreateNestedManyWithoutStateInput
  }

  export type StateUpdateInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    language?: LanguageUpdateOneRequiredWithoutStatesNestedInput
    users?: UserUpdateManyWithoutStateNestedInput
  }

  export type StateUncheckedUpdateInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    languageId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUncheckedUpdateManyWithoutStateNestedInput
  }

  export type StateCreateManyInput = {
    stateId?: string
    name: string
    languageId: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StateUpdateManyMutationInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StateUncheckedUpdateManyInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    languageId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleCreateInput = {
    roleId?: string
    name: $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    users?: UserCreateNestedManyWithoutRoleInput
  }

  export type RoleUncheckedCreateInput = {
    roleId?: string
    name: $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    users?: UserUncheckedCreateNestedManyWithoutRoleInput
  }

  export type RoleUpdateInput = {
    roleId?: StringFieldUpdateOperationsInput | string
    name?: EnumRoleNameFieldUpdateOperationsInput | $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUpdateManyWithoutRoleNestedInput
  }

  export type RoleUncheckedUpdateInput = {
    roleId?: StringFieldUpdateOperationsInput | string
    name?: EnumRoleNameFieldUpdateOperationsInput | $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUncheckedUpdateManyWithoutRoleNestedInput
  }

  export type RoleCreateManyInput = {
    roleId?: string
    name: $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type RoleUpdateManyMutationInput = {
    roleId?: StringFieldUpdateOperationsInput | string
    name?: EnumRoleNameFieldUpdateOperationsInput | $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleUncheckedUpdateManyInput = {
    roleId?: StringFieldUpdateOperationsInput | string
    name?: EnumRoleNameFieldUpdateOperationsInput | $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    role: RoleCreateNestedOneWithoutUsersInput
    language?: LanguageCreateNestedOneWithoutUsersInput
    state?: StateCreateNestedOneWithoutUsersInput
  }

  export type UserUncheckedCreateInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    roleId: string
    languageId?: string | null
    stateId?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    role?: RoleUpdateOneRequiredWithoutUsersNestedInput
    language?: LanguageUpdateOneWithoutUsersNestedInput
    state?: StateUpdateOneWithoutUsersNestedInput
  }

  export type UserUncheckedUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: StringFieldUpdateOperationsInput | string
    languageId?: NullableStringFieldUpdateOperationsInput | string | null
    stateId?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateManyInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    roleId: string
    languageId?: string | null
    stateId?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: StringFieldUpdateOperationsInput | string
    languageId?: NullableStringFieldUpdateOperationsInput | string | null
    stateId?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryCreateInput = {
    categoryId?: string
    key: string
    iconUrl?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    translations?: CategoryTranslationCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUncheckedCreateInput = {
    categoryId?: string
    key: string
    iconUrl?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    translations?: CategoryTranslationUncheckedCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUpdateInput = {
    categoryId?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    iconUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    translations?: CategoryTranslationUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryUncheckedUpdateInput = {
    categoryId?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    iconUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    translations?: CategoryTranslationUncheckedUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryCreateManyInput = {
    categoryId?: string
    key: string
    iconUrl?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CategoryUpdateManyMutationInput = {
    categoryId?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    iconUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryUncheckedUpdateManyInput = {
    categoryId?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    iconUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryTranslationCreateInput = {
    translationId?: string
    displayName: string
    createdAt?: Date | string
    category: CategoryCreateNestedOneWithoutTranslationsInput
    language: LanguageCreateNestedOneWithoutCategoryTranslationInput
  }

  export type CategoryTranslationUncheckedCreateInput = {
    translationId?: string
    categoryId: string
    languageId: string
    displayName: string
    createdAt?: Date | string
  }

  export type CategoryTranslationUpdateInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutTranslationsNestedInput
    language?: LanguageUpdateOneRequiredWithoutCategoryTranslationNestedInput
  }

  export type CategoryTranslationUncheckedUpdateInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    categoryId?: StringFieldUpdateOperationsInput | string
    languageId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryTranslationCreateManyInput = {
    translationId?: string
    categoryId: string
    languageId: string
    displayName: string
    createdAt?: Date | string
  }

  export type CategoryTranslationUpdateManyMutationInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryTranslationUncheckedUpdateManyInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    categoryId?: StringFieldUpdateOperationsInput | string
    languageId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type StateListRelationFilter = {
    every?: StateWhereInput
    some?: StateWhereInput
    none?: StateWhereInput
  }

  export type UserListRelationFilter = {
    every?: UserWhereInput
    some?: UserWhereInput
    none?: UserWhereInput
  }

  export type CategoryTranslationListRelationFilter = {
    every?: CategoryTranslationWhereInput
    some?: CategoryTranslationWhereInput
    none?: CategoryTranslationWhereInput
  }

  export type StateOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CategoryTranslationOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type LanguageCountOrderByAggregateInput = {
    languageId?: SortOrder
    name?: SortOrder
    code?: SortOrder
    isRTL?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LanguageMaxOrderByAggregateInput = {
    languageId?: SortOrder
    name?: SortOrder
    code?: SortOrder
    isRTL?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LanguageMinOrderByAggregateInput = {
    languageId?: SortOrder
    name?: SortOrder
    code?: SortOrder
    isRTL?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type LanguageScalarRelationFilter = {
    is?: LanguageWhereInput
    isNot?: LanguageWhereInput
  }

  export type StateCountOrderByAggregateInput = {
    stateId?: SortOrder
    name?: SortOrder
    languageId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StateMaxOrderByAggregateInput = {
    stateId?: SortOrder
    name?: SortOrder
    languageId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StateMinOrderByAggregateInput = {
    stateId?: SortOrder
    name?: SortOrder
    languageId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumRoleNameFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleName | EnumRoleNameFieldRefInput<$PrismaModel>
    in?: $Enums.RoleName[] | ListEnumRoleNameFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleName[] | ListEnumRoleNameFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleNameFilter<$PrismaModel> | $Enums.RoleName
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type RoleCountOrderByAggregateInput = {
    roleId?: SortOrder
    name?: SortOrder
    permissions?: SortOrder
    createdAt?: SortOrder
  }

  export type RoleMaxOrderByAggregateInput = {
    roleId?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
  }

  export type RoleMinOrderByAggregateInput = {
    roleId?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
  }

  export type EnumRoleNameWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleName | EnumRoleNameFieldRefInput<$PrismaModel>
    in?: $Enums.RoleName[] | ListEnumRoleNameFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleName[] | ListEnumRoleNameFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleNameWithAggregatesFilter<$PrismaModel> | $Enums.RoleName
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleNameFilter<$PrismaModel>
    _max?: NestedEnumRoleNameFilter<$PrismaModel>
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type RoleScalarRelationFilter = {
    is?: RoleWhereInput
    isNot?: RoleWhereInput
  }

  export type LanguageNullableScalarRelationFilter = {
    is?: LanguageWhereInput | null
    isNot?: LanguageWhereInput | null
  }

  export type StateNullableScalarRelationFilter = {
    is?: StateWhereInput | null
    isNot?: StateWhereInput | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type UserCountOrderByAggregateInput = {
    userId?: SortOrder
    mobileNumber?: SortOrder
    mpin?: SortOrder
    deviceId?: SortOrder
    fcmToken?: SortOrder
    roleId?: SortOrder
    languageId?: SortOrder
    stateId?: SortOrder
    isVerified?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    userId?: SortOrder
    mobileNumber?: SortOrder
    mpin?: SortOrder
    deviceId?: SortOrder
    fcmToken?: SortOrder
    roleId?: SortOrder
    languageId?: SortOrder
    stateId?: SortOrder
    isVerified?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    userId?: SortOrder
    mobileNumber?: SortOrder
    mpin?: SortOrder
    deviceId?: SortOrder
    fcmToken?: SortOrder
    roleId?: SortOrder
    languageId?: SortOrder
    stateId?: SortOrder
    isVerified?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type CategoryCountOrderByAggregateInput = {
    categoryId?: SortOrder
    key?: SortOrder
    iconUrl?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategoryMaxOrderByAggregateInput = {
    categoryId?: SortOrder
    key?: SortOrder
    iconUrl?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategoryMinOrderByAggregateInput = {
    categoryId?: SortOrder
    key?: SortOrder
    iconUrl?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategoryScalarRelationFilter = {
    is?: CategoryWhereInput
    isNot?: CategoryWhereInput
  }

  export type CategoryTranslationCountOrderByAggregateInput = {
    translationId?: SortOrder
    categoryId?: SortOrder
    languageId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
  }

  export type CategoryTranslationMaxOrderByAggregateInput = {
    translationId?: SortOrder
    categoryId?: SortOrder
    languageId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
  }

  export type CategoryTranslationMinOrderByAggregateInput = {
    translationId?: SortOrder
    categoryId?: SortOrder
    languageId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
  }

  export type StateCreateNestedManyWithoutLanguageInput = {
    create?: XOR<StateCreateWithoutLanguageInput, StateUncheckedCreateWithoutLanguageInput> | StateCreateWithoutLanguageInput[] | StateUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: StateCreateOrConnectWithoutLanguageInput | StateCreateOrConnectWithoutLanguageInput[]
    createMany?: StateCreateManyLanguageInputEnvelope
    connect?: StateWhereUniqueInput | StateWhereUniqueInput[]
  }

  export type UserCreateNestedManyWithoutLanguageInput = {
    create?: XOR<UserCreateWithoutLanguageInput, UserUncheckedCreateWithoutLanguageInput> | UserCreateWithoutLanguageInput[] | UserUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: UserCreateOrConnectWithoutLanguageInput | UserCreateOrConnectWithoutLanguageInput[]
    createMany?: UserCreateManyLanguageInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type CategoryTranslationCreateNestedManyWithoutLanguageInput = {
    create?: XOR<CategoryTranslationCreateWithoutLanguageInput, CategoryTranslationUncheckedCreateWithoutLanguageInput> | CategoryTranslationCreateWithoutLanguageInput[] | CategoryTranslationUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: CategoryTranslationCreateOrConnectWithoutLanguageInput | CategoryTranslationCreateOrConnectWithoutLanguageInput[]
    createMany?: CategoryTranslationCreateManyLanguageInputEnvelope
    connect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
  }

  export type StateUncheckedCreateNestedManyWithoutLanguageInput = {
    create?: XOR<StateCreateWithoutLanguageInput, StateUncheckedCreateWithoutLanguageInput> | StateCreateWithoutLanguageInput[] | StateUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: StateCreateOrConnectWithoutLanguageInput | StateCreateOrConnectWithoutLanguageInput[]
    createMany?: StateCreateManyLanguageInputEnvelope
    connect?: StateWhereUniqueInput | StateWhereUniqueInput[]
  }

  export type UserUncheckedCreateNestedManyWithoutLanguageInput = {
    create?: XOR<UserCreateWithoutLanguageInput, UserUncheckedCreateWithoutLanguageInput> | UserCreateWithoutLanguageInput[] | UserUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: UserCreateOrConnectWithoutLanguageInput | UserCreateOrConnectWithoutLanguageInput[]
    createMany?: UserCreateManyLanguageInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type CategoryTranslationUncheckedCreateNestedManyWithoutLanguageInput = {
    create?: XOR<CategoryTranslationCreateWithoutLanguageInput, CategoryTranslationUncheckedCreateWithoutLanguageInput> | CategoryTranslationCreateWithoutLanguageInput[] | CategoryTranslationUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: CategoryTranslationCreateOrConnectWithoutLanguageInput | CategoryTranslationCreateOrConnectWithoutLanguageInput[]
    createMany?: CategoryTranslationCreateManyLanguageInputEnvelope
    connect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type StateUpdateManyWithoutLanguageNestedInput = {
    create?: XOR<StateCreateWithoutLanguageInput, StateUncheckedCreateWithoutLanguageInput> | StateCreateWithoutLanguageInput[] | StateUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: StateCreateOrConnectWithoutLanguageInput | StateCreateOrConnectWithoutLanguageInput[]
    upsert?: StateUpsertWithWhereUniqueWithoutLanguageInput | StateUpsertWithWhereUniqueWithoutLanguageInput[]
    createMany?: StateCreateManyLanguageInputEnvelope
    set?: StateWhereUniqueInput | StateWhereUniqueInput[]
    disconnect?: StateWhereUniqueInput | StateWhereUniqueInput[]
    delete?: StateWhereUniqueInput | StateWhereUniqueInput[]
    connect?: StateWhereUniqueInput | StateWhereUniqueInput[]
    update?: StateUpdateWithWhereUniqueWithoutLanguageInput | StateUpdateWithWhereUniqueWithoutLanguageInput[]
    updateMany?: StateUpdateManyWithWhereWithoutLanguageInput | StateUpdateManyWithWhereWithoutLanguageInput[]
    deleteMany?: StateScalarWhereInput | StateScalarWhereInput[]
  }

  export type UserUpdateManyWithoutLanguageNestedInput = {
    create?: XOR<UserCreateWithoutLanguageInput, UserUncheckedCreateWithoutLanguageInput> | UserCreateWithoutLanguageInput[] | UserUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: UserCreateOrConnectWithoutLanguageInput | UserCreateOrConnectWithoutLanguageInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutLanguageInput | UserUpsertWithWhereUniqueWithoutLanguageInput[]
    createMany?: UserCreateManyLanguageInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutLanguageInput | UserUpdateWithWhereUniqueWithoutLanguageInput[]
    updateMany?: UserUpdateManyWithWhereWithoutLanguageInput | UserUpdateManyWithWhereWithoutLanguageInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type CategoryTranslationUpdateManyWithoutLanguageNestedInput = {
    create?: XOR<CategoryTranslationCreateWithoutLanguageInput, CategoryTranslationUncheckedCreateWithoutLanguageInput> | CategoryTranslationCreateWithoutLanguageInput[] | CategoryTranslationUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: CategoryTranslationCreateOrConnectWithoutLanguageInput | CategoryTranslationCreateOrConnectWithoutLanguageInput[]
    upsert?: CategoryTranslationUpsertWithWhereUniqueWithoutLanguageInput | CategoryTranslationUpsertWithWhereUniqueWithoutLanguageInput[]
    createMany?: CategoryTranslationCreateManyLanguageInputEnvelope
    set?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    disconnect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    delete?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    connect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    update?: CategoryTranslationUpdateWithWhereUniqueWithoutLanguageInput | CategoryTranslationUpdateWithWhereUniqueWithoutLanguageInput[]
    updateMany?: CategoryTranslationUpdateManyWithWhereWithoutLanguageInput | CategoryTranslationUpdateManyWithWhereWithoutLanguageInput[]
    deleteMany?: CategoryTranslationScalarWhereInput | CategoryTranslationScalarWhereInput[]
  }

  export type StateUncheckedUpdateManyWithoutLanguageNestedInput = {
    create?: XOR<StateCreateWithoutLanguageInput, StateUncheckedCreateWithoutLanguageInput> | StateCreateWithoutLanguageInput[] | StateUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: StateCreateOrConnectWithoutLanguageInput | StateCreateOrConnectWithoutLanguageInput[]
    upsert?: StateUpsertWithWhereUniqueWithoutLanguageInput | StateUpsertWithWhereUniqueWithoutLanguageInput[]
    createMany?: StateCreateManyLanguageInputEnvelope
    set?: StateWhereUniqueInput | StateWhereUniqueInput[]
    disconnect?: StateWhereUniqueInput | StateWhereUniqueInput[]
    delete?: StateWhereUniqueInput | StateWhereUniqueInput[]
    connect?: StateWhereUniqueInput | StateWhereUniqueInput[]
    update?: StateUpdateWithWhereUniqueWithoutLanguageInput | StateUpdateWithWhereUniqueWithoutLanguageInput[]
    updateMany?: StateUpdateManyWithWhereWithoutLanguageInput | StateUpdateManyWithWhereWithoutLanguageInput[]
    deleteMany?: StateScalarWhereInput | StateScalarWhereInput[]
  }

  export type UserUncheckedUpdateManyWithoutLanguageNestedInput = {
    create?: XOR<UserCreateWithoutLanguageInput, UserUncheckedCreateWithoutLanguageInput> | UserCreateWithoutLanguageInput[] | UserUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: UserCreateOrConnectWithoutLanguageInput | UserCreateOrConnectWithoutLanguageInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutLanguageInput | UserUpsertWithWhereUniqueWithoutLanguageInput[]
    createMany?: UserCreateManyLanguageInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutLanguageInput | UserUpdateWithWhereUniqueWithoutLanguageInput[]
    updateMany?: UserUpdateManyWithWhereWithoutLanguageInput | UserUpdateManyWithWhereWithoutLanguageInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type CategoryTranslationUncheckedUpdateManyWithoutLanguageNestedInput = {
    create?: XOR<CategoryTranslationCreateWithoutLanguageInput, CategoryTranslationUncheckedCreateWithoutLanguageInput> | CategoryTranslationCreateWithoutLanguageInput[] | CategoryTranslationUncheckedCreateWithoutLanguageInput[]
    connectOrCreate?: CategoryTranslationCreateOrConnectWithoutLanguageInput | CategoryTranslationCreateOrConnectWithoutLanguageInput[]
    upsert?: CategoryTranslationUpsertWithWhereUniqueWithoutLanguageInput | CategoryTranslationUpsertWithWhereUniqueWithoutLanguageInput[]
    createMany?: CategoryTranslationCreateManyLanguageInputEnvelope
    set?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    disconnect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    delete?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    connect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    update?: CategoryTranslationUpdateWithWhereUniqueWithoutLanguageInput | CategoryTranslationUpdateWithWhereUniqueWithoutLanguageInput[]
    updateMany?: CategoryTranslationUpdateManyWithWhereWithoutLanguageInput | CategoryTranslationUpdateManyWithWhereWithoutLanguageInput[]
    deleteMany?: CategoryTranslationScalarWhereInput | CategoryTranslationScalarWhereInput[]
  }

  export type LanguageCreateNestedOneWithoutStatesInput = {
    create?: XOR<LanguageCreateWithoutStatesInput, LanguageUncheckedCreateWithoutStatesInput>
    connectOrCreate?: LanguageCreateOrConnectWithoutStatesInput
    connect?: LanguageWhereUniqueInput
  }

  export type UserCreateNestedManyWithoutStateInput = {
    create?: XOR<UserCreateWithoutStateInput, UserUncheckedCreateWithoutStateInput> | UserCreateWithoutStateInput[] | UserUncheckedCreateWithoutStateInput[]
    connectOrCreate?: UserCreateOrConnectWithoutStateInput | UserCreateOrConnectWithoutStateInput[]
    createMany?: UserCreateManyStateInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type UserUncheckedCreateNestedManyWithoutStateInput = {
    create?: XOR<UserCreateWithoutStateInput, UserUncheckedCreateWithoutStateInput> | UserCreateWithoutStateInput[] | UserUncheckedCreateWithoutStateInput[]
    connectOrCreate?: UserCreateOrConnectWithoutStateInput | UserCreateOrConnectWithoutStateInput[]
    createMany?: UserCreateManyStateInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type LanguageUpdateOneRequiredWithoutStatesNestedInput = {
    create?: XOR<LanguageCreateWithoutStatesInput, LanguageUncheckedCreateWithoutStatesInput>
    connectOrCreate?: LanguageCreateOrConnectWithoutStatesInput
    upsert?: LanguageUpsertWithoutStatesInput
    connect?: LanguageWhereUniqueInput
    update?: XOR<XOR<LanguageUpdateToOneWithWhereWithoutStatesInput, LanguageUpdateWithoutStatesInput>, LanguageUncheckedUpdateWithoutStatesInput>
  }

  export type UserUpdateManyWithoutStateNestedInput = {
    create?: XOR<UserCreateWithoutStateInput, UserUncheckedCreateWithoutStateInput> | UserCreateWithoutStateInput[] | UserUncheckedCreateWithoutStateInput[]
    connectOrCreate?: UserCreateOrConnectWithoutStateInput | UserCreateOrConnectWithoutStateInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutStateInput | UserUpsertWithWhereUniqueWithoutStateInput[]
    createMany?: UserCreateManyStateInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutStateInput | UserUpdateWithWhereUniqueWithoutStateInput[]
    updateMany?: UserUpdateManyWithWhereWithoutStateInput | UserUpdateManyWithWhereWithoutStateInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type UserUncheckedUpdateManyWithoutStateNestedInput = {
    create?: XOR<UserCreateWithoutStateInput, UserUncheckedCreateWithoutStateInput> | UserCreateWithoutStateInput[] | UserUncheckedCreateWithoutStateInput[]
    connectOrCreate?: UserCreateOrConnectWithoutStateInput | UserCreateOrConnectWithoutStateInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutStateInput | UserUpsertWithWhereUniqueWithoutStateInput[]
    createMany?: UserCreateManyStateInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutStateInput | UserUpdateWithWhereUniqueWithoutStateInput[]
    updateMany?: UserUpdateManyWithWhereWithoutStateInput | UserUpdateManyWithWhereWithoutStateInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type UserCreateNestedManyWithoutRoleInput = {
    create?: XOR<UserCreateWithoutRoleInput, UserUncheckedCreateWithoutRoleInput> | UserCreateWithoutRoleInput[] | UserUncheckedCreateWithoutRoleInput[]
    connectOrCreate?: UserCreateOrConnectWithoutRoleInput | UserCreateOrConnectWithoutRoleInput[]
    createMany?: UserCreateManyRoleInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type UserUncheckedCreateNestedManyWithoutRoleInput = {
    create?: XOR<UserCreateWithoutRoleInput, UserUncheckedCreateWithoutRoleInput> | UserCreateWithoutRoleInput[] | UserUncheckedCreateWithoutRoleInput[]
    connectOrCreate?: UserCreateOrConnectWithoutRoleInput | UserCreateOrConnectWithoutRoleInput[]
    createMany?: UserCreateManyRoleInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type EnumRoleNameFieldUpdateOperationsInput = {
    set?: $Enums.RoleName
  }

  export type UserUpdateManyWithoutRoleNestedInput = {
    create?: XOR<UserCreateWithoutRoleInput, UserUncheckedCreateWithoutRoleInput> | UserCreateWithoutRoleInput[] | UserUncheckedCreateWithoutRoleInput[]
    connectOrCreate?: UserCreateOrConnectWithoutRoleInput | UserCreateOrConnectWithoutRoleInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutRoleInput | UserUpsertWithWhereUniqueWithoutRoleInput[]
    createMany?: UserCreateManyRoleInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutRoleInput | UserUpdateWithWhereUniqueWithoutRoleInput[]
    updateMany?: UserUpdateManyWithWhereWithoutRoleInput | UserUpdateManyWithWhereWithoutRoleInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type UserUncheckedUpdateManyWithoutRoleNestedInput = {
    create?: XOR<UserCreateWithoutRoleInput, UserUncheckedCreateWithoutRoleInput> | UserCreateWithoutRoleInput[] | UserUncheckedCreateWithoutRoleInput[]
    connectOrCreate?: UserCreateOrConnectWithoutRoleInput | UserCreateOrConnectWithoutRoleInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutRoleInput | UserUpsertWithWhereUniqueWithoutRoleInput[]
    createMany?: UserCreateManyRoleInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutRoleInput | UserUpdateWithWhereUniqueWithoutRoleInput[]
    updateMany?: UserUpdateManyWithWhereWithoutRoleInput | UserUpdateManyWithWhereWithoutRoleInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type RoleCreateNestedOneWithoutUsersInput = {
    create?: XOR<RoleCreateWithoutUsersInput, RoleUncheckedCreateWithoutUsersInput>
    connectOrCreate?: RoleCreateOrConnectWithoutUsersInput
    connect?: RoleWhereUniqueInput
  }

  export type LanguageCreateNestedOneWithoutUsersInput = {
    create?: XOR<LanguageCreateWithoutUsersInput, LanguageUncheckedCreateWithoutUsersInput>
    connectOrCreate?: LanguageCreateOrConnectWithoutUsersInput
    connect?: LanguageWhereUniqueInput
  }

  export type StateCreateNestedOneWithoutUsersInput = {
    create?: XOR<StateCreateWithoutUsersInput, StateUncheckedCreateWithoutUsersInput>
    connectOrCreate?: StateCreateOrConnectWithoutUsersInput
    connect?: StateWhereUniqueInput
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type RoleUpdateOneRequiredWithoutUsersNestedInput = {
    create?: XOR<RoleCreateWithoutUsersInput, RoleUncheckedCreateWithoutUsersInput>
    connectOrCreate?: RoleCreateOrConnectWithoutUsersInput
    upsert?: RoleUpsertWithoutUsersInput
    connect?: RoleWhereUniqueInput
    update?: XOR<XOR<RoleUpdateToOneWithWhereWithoutUsersInput, RoleUpdateWithoutUsersInput>, RoleUncheckedUpdateWithoutUsersInput>
  }

  export type LanguageUpdateOneWithoutUsersNestedInput = {
    create?: XOR<LanguageCreateWithoutUsersInput, LanguageUncheckedCreateWithoutUsersInput>
    connectOrCreate?: LanguageCreateOrConnectWithoutUsersInput
    upsert?: LanguageUpsertWithoutUsersInput
    disconnect?: LanguageWhereInput | boolean
    delete?: LanguageWhereInput | boolean
    connect?: LanguageWhereUniqueInput
    update?: XOR<XOR<LanguageUpdateToOneWithWhereWithoutUsersInput, LanguageUpdateWithoutUsersInput>, LanguageUncheckedUpdateWithoutUsersInput>
  }

  export type StateUpdateOneWithoutUsersNestedInput = {
    create?: XOR<StateCreateWithoutUsersInput, StateUncheckedCreateWithoutUsersInput>
    connectOrCreate?: StateCreateOrConnectWithoutUsersInput
    upsert?: StateUpsertWithoutUsersInput
    disconnect?: StateWhereInput | boolean
    delete?: StateWhereInput | boolean
    connect?: StateWhereUniqueInput
    update?: XOR<XOR<StateUpdateToOneWithWhereWithoutUsersInput, StateUpdateWithoutUsersInput>, StateUncheckedUpdateWithoutUsersInput>
  }

  export type CategoryTranslationCreateNestedManyWithoutCategoryInput = {
    create?: XOR<CategoryTranslationCreateWithoutCategoryInput, CategoryTranslationUncheckedCreateWithoutCategoryInput> | CategoryTranslationCreateWithoutCategoryInput[] | CategoryTranslationUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: CategoryTranslationCreateOrConnectWithoutCategoryInput | CategoryTranslationCreateOrConnectWithoutCategoryInput[]
    createMany?: CategoryTranslationCreateManyCategoryInputEnvelope
    connect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
  }

  export type CategoryTranslationUncheckedCreateNestedManyWithoutCategoryInput = {
    create?: XOR<CategoryTranslationCreateWithoutCategoryInput, CategoryTranslationUncheckedCreateWithoutCategoryInput> | CategoryTranslationCreateWithoutCategoryInput[] | CategoryTranslationUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: CategoryTranslationCreateOrConnectWithoutCategoryInput | CategoryTranslationCreateOrConnectWithoutCategoryInput[]
    createMany?: CategoryTranslationCreateManyCategoryInputEnvelope
    connect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
  }

  export type CategoryTranslationUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<CategoryTranslationCreateWithoutCategoryInput, CategoryTranslationUncheckedCreateWithoutCategoryInput> | CategoryTranslationCreateWithoutCategoryInput[] | CategoryTranslationUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: CategoryTranslationCreateOrConnectWithoutCategoryInput | CategoryTranslationCreateOrConnectWithoutCategoryInput[]
    upsert?: CategoryTranslationUpsertWithWhereUniqueWithoutCategoryInput | CategoryTranslationUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: CategoryTranslationCreateManyCategoryInputEnvelope
    set?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    disconnect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    delete?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    connect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    update?: CategoryTranslationUpdateWithWhereUniqueWithoutCategoryInput | CategoryTranslationUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: CategoryTranslationUpdateManyWithWhereWithoutCategoryInput | CategoryTranslationUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: CategoryTranslationScalarWhereInput | CategoryTranslationScalarWhereInput[]
  }

  export type CategoryTranslationUncheckedUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<CategoryTranslationCreateWithoutCategoryInput, CategoryTranslationUncheckedCreateWithoutCategoryInput> | CategoryTranslationCreateWithoutCategoryInput[] | CategoryTranslationUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: CategoryTranslationCreateOrConnectWithoutCategoryInput | CategoryTranslationCreateOrConnectWithoutCategoryInput[]
    upsert?: CategoryTranslationUpsertWithWhereUniqueWithoutCategoryInput | CategoryTranslationUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: CategoryTranslationCreateManyCategoryInputEnvelope
    set?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    disconnect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    delete?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    connect?: CategoryTranslationWhereUniqueInput | CategoryTranslationWhereUniqueInput[]
    update?: CategoryTranslationUpdateWithWhereUniqueWithoutCategoryInput | CategoryTranslationUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: CategoryTranslationUpdateManyWithWhereWithoutCategoryInput | CategoryTranslationUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: CategoryTranslationScalarWhereInput | CategoryTranslationScalarWhereInput[]
  }

  export type CategoryCreateNestedOneWithoutTranslationsInput = {
    create?: XOR<CategoryCreateWithoutTranslationsInput, CategoryUncheckedCreateWithoutTranslationsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutTranslationsInput
    connect?: CategoryWhereUniqueInput
  }

  export type LanguageCreateNestedOneWithoutCategoryTranslationInput = {
    create?: XOR<LanguageCreateWithoutCategoryTranslationInput, LanguageUncheckedCreateWithoutCategoryTranslationInput>
    connectOrCreate?: LanguageCreateOrConnectWithoutCategoryTranslationInput
    connect?: LanguageWhereUniqueInput
  }

  export type CategoryUpdateOneRequiredWithoutTranslationsNestedInput = {
    create?: XOR<CategoryCreateWithoutTranslationsInput, CategoryUncheckedCreateWithoutTranslationsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutTranslationsInput
    upsert?: CategoryUpsertWithoutTranslationsInput
    connect?: CategoryWhereUniqueInput
    update?: XOR<XOR<CategoryUpdateToOneWithWhereWithoutTranslationsInput, CategoryUpdateWithoutTranslationsInput>, CategoryUncheckedUpdateWithoutTranslationsInput>
  }

  export type LanguageUpdateOneRequiredWithoutCategoryTranslationNestedInput = {
    create?: XOR<LanguageCreateWithoutCategoryTranslationInput, LanguageUncheckedCreateWithoutCategoryTranslationInput>
    connectOrCreate?: LanguageCreateOrConnectWithoutCategoryTranslationInput
    upsert?: LanguageUpsertWithoutCategoryTranslationInput
    connect?: LanguageWhereUniqueInput
    update?: XOR<XOR<LanguageUpdateToOneWithWhereWithoutCategoryTranslationInput, LanguageUpdateWithoutCategoryTranslationInput>, LanguageUncheckedUpdateWithoutCategoryTranslationInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumRoleNameFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleName | EnumRoleNameFieldRefInput<$PrismaModel>
    in?: $Enums.RoleName[] | ListEnumRoleNameFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleName[] | ListEnumRoleNameFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleNameFilter<$PrismaModel> | $Enums.RoleName
  }

  export type NestedEnumRoleNameWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleName | EnumRoleNameFieldRefInput<$PrismaModel>
    in?: $Enums.RoleName[] | ListEnumRoleNameFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleName[] | ListEnumRoleNameFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleNameWithAggregatesFilter<$PrismaModel> | $Enums.RoleName
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleNameFilter<$PrismaModel>
    _max?: NestedEnumRoleNameFilter<$PrismaModel>
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type StateCreateWithoutLanguageInput = {
    stateId?: string
    name: string
    createdAt?: Date | string
    updatedAt?: Date | string
    users?: UserCreateNestedManyWithoutStateInput
  }

  export type StateUncheckedCreateWithoutLanguageInput = {
    stateId?: string
    name: string
    createdAt?: Date | string
    updatedAt?: Date | string
    users?: UserUncheckedCreateNestedManyWithoutStateInput
  }

  export type StateCreateOrConnectWithoutLanguageInput = {
    where: StateWhereUniqueInput
    create: XOR<StateCreateWithoutLanguageInput, StateUncheckedCreateWithoutLanguageInput>
  }

  export type StateCreateManyLanguageInputEnvelope = {
    data: StateCreateManyLanguageInput | StateCreateManyLanguageInput[]
    skipDuplicates?: boolean
  }

  export type UserCreateWithoutLanguageInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    role: RoleCreateNestedOneWithoutUsersInput
    state?: StateCreateNestedOneWithoutUsersInput
  }

  export type UserUncheckedCreateWithoutLanguageInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    roleId: string
    stateId?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserCreateOrConnectWithoutLanguageInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutLanguageInput, UserUncheckedCreateWithoutLanguageInput>
  }

  export type UserCreateManyLanguageInputEnvelope = {
    data: UserCreateManyLanguageInput | UserCreateManyLanguageInput[]
    skipDuplicates?: boolean
  }

  export type CategoryTranslationCreateWithoutLanguageInput = {
    translationId?: string
    displayName: string
    createdAt?: Date | string
    category: CategoryCreateNestedOneWithoutTranslationsInput
  }

  export type CategoryTranslationUncheckedCreateWithoutLanguageInput = {
    translationId?: string
    categoryId: string
    displayName: string
    createdAt?: Date | string
  }

  export type CategoryTranslationCreateOrConnectWithoutLanguageInput = {
    where: CategoryTranslationWhereUniqueInput
    create: XOR<CategoryTranslationCreateWithoutLanguageInput, CategoryTranslationUncheckedCreateWithoutLanguageInput>
  }

  export type CategoryTranslationCreateManyLanguageInputEnvelope = {
    data: CategoryTranslationCreateManyLanguageInput | CategoryTranslationCreateManyLanguageInput[]
    skipDuplicates?: boolean
  }

  export type StateUpsertWithWhereUniqueWithoutLanguageInput = {
    where: StateWhereUniqueInput
    update: XOR<StateUpdateWithoutLanguageInput, StateUncheckedUpdateWithoutLanguageInput>
    create: XOR<StateCreateWithoutLanguageInput, StateUncheckedCreateWithoutLanguageInput>
  }

  export type StateUpdateWithWhereUniqueWithoutLanguageInput = {
    where: StateWhereUniqueInput
    data: XOR<StateUpdateWithoutLanguageInput, StateUncheckedUpdateWithoutLanguageInput>
  }

  export type StateUpdateManyWithWhereWithoutLanguageInput = {
    where: StateScalarWhereInput
    data: XOR<StateUpdateManyMutationInput, StateUncheckedUpdateManyWithoutLanguageInput>
  }

  export type StateScalarWhereInput = {
    AND?: StateScalarWhereInput | StateScalarWhereInput[]
    OR?: StateScalarWhereInput[]
    NOT?: StateScalarWhereInput | StateScalarWhereInput[]
    stateId?: StringFilter<"State"> | string
    name?: StringFilter<"State"> | string
    languageId?: StringFilter<"State"> | string
    createdAt?: DateTimeFilter<"State"> | Date | string
    updatedAt?: DateTimeFilter<"State"> | Date | string
  }

  export type UserUpsertWithWhereUniqueWithoutLanguageInput = {
    where: UserWhereUniqueInput
    update: XOR<UserUpdateWithoutLanguageInput, UserUncheckedUpdateWithoutLanguageInput>
    create: XOR<UserCreateWithoutLanguageInput, UserUncheckedCreateWithoutLanguageInput>
  }

  export type UserUpdateWithWhereUniqueWithoutLanguageInput = {
    where: UserWhereUniqueInput
    data: XOR<UserUpdateWithoutLanguageInput, UserUncheckedUpdateWithoutLanguageInput>
  }

  export type UserUpdateManyWithWhereWithoutLanguageInput = {
    where: UserScalarWhereInput
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyWithoutLanguageInput>
  }

  export type UserScalarWhereInput = {
    AND?: UserScalarWhereInput | UserScalarWhereInput[]
    OR?: UserScalarWhereInput[]
    NOT?: UserScalarWhereInput | UserScalarWhereInput[]
    userId?: StringFilter<"User"> | string
    mobileNumber?: StringFilter<"User"> | string
    mpin?: StringFilter<"User"> | string
    deviceId?: StringNullableFilter<"User"> | string | null
    fcmToken?: StringNullableFilter<"User"> | string | null
    roleId?: StringFilter<"User"> | string
    languageId?: StringNullableFilter<"User"> | string | null
    stateId?: StringNullableFilter<"User"> | string | null
    isVerified?: BoolFilter<"User"> | boolean
    status?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
  }

  export type CategoryTranslationUpsertWithWhereUniqueWithoutLanguageInput = {
    where: CategoryTranslationWhereUniqueInput
    update: XOR<CategoryTranslationUpdateWithoutLanguageInput, CategoryTranslationUncheckedUpdateWithoutLanguageInput>
    create: XOR<CategoryTranslationCreateWithoutLanguageInput, CategoryTranslationUncheckedCreateWithoutLanguageInput>
  }

  export type CategoryTranslationUpdateWithWhereUniqueWithoutLanguageInput = {
    where: CategoryTranslationWhereUniqueInput
    data: XOR<CategoryTranslationUpdateWithoutLanguageInput, CategoryTranslationUncheckedUpdateWithoutLanguageInput>
  }

  export type CategoryTranslationUpdateManyWithWhereWithoutLanguageInput = {
    where: CategoryTranslationScalarWhereInput
    data: XOR<CategoryTranslationUpdateManyMutationInput, CategoryTranslationUncheckedUpdateManyWithoutLanguageInput>
  }

  export type CategoryTranslationScalarWhereInput = {
    AND?: CategoryTranslationScalarWhereInput | CategoryTranslationScalarWhereInput[]
    OR?: CategoryTranslationScalarWhereInput[]
    NOT?: CategoryTranslationScalarWhereInput | CategoryTranslationScalarWhereInput[]
    translationId?: StringFilter<"CategoryTranslation"> | string
    categoryId?: StringFilter<"CategoryTranslation"> | string
    languageId?: StringFilter<"CategoryTranslation"> | string
    displayName?: StringFilter<"CategoryTranslation"> | string
    createdAt?: DateTimeFilter<"CategoryTranslation"> | Date | string
  }

  export type LanguageCreateWithoutStatesInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    users?: UserCreateNestedManyWithoutLanguageInput
    CategoryTranslation?: CategoryTranslationCreateNestedManyWithoutLanguageInput
  }

  export type LanguageUncheckedCreateWithoutStatesInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    users?: UserUncheckedCreateNestedManyWithoutLanguageInput
    CategoryTranslation?: CategoryTranslationUncheckedCreateNestedManyWithoutLanguageInput
  }

  export type LanguageCreateOrConnectWithoutStatesInput = {
    where: LanguageWhereUniqueInput
    create: XOR<LanguageCreateWithoutStatesInput, LanguageUncheckedCreateWithoutStatesInput>
  }

  export type UserCreateWithoutStateInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    role: RoleCreateNestedOneWithoutUsersInput
    language?: LanguageCreateNestedOneWithoutUsersInput
  }

  export type UserUncheckedCreateWithoutStateInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    roleId: string
    languageId?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserCreateOrConnectWithoutStateInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutStateInput, UserUncheckedCreateWithoutStateInput>
  }

  export type UserCreateManyStateInputEnvelope = {
    data: UserCreateManyStateInput | UserCreateManyStateInput[]
    skipDuplicates?: boolean
  }

  export type LanguageUpsertWithoutStatesInput = {
    update: XOR<LanguageUpdateWithoutStatesInput, LanguageUncheckedUpdateWithoutStatesInput>
    create: XOR<LanguageCreateWithoutStatesInput, LanguageUncheckedCreateWithoutStatesInput>
    where?: LanguageWhereInput
  }

  export type LanguageUpdateToOneWithWhereWithoutStatesInput = {
    where?: LanguageWhereInput
    data: XOR<LanguageUpdateWithoutStatesInput, LanguageUncheckedUpdateWithoutStatesInput>
  }

  export type LanguageUpdateWithoutStatesInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUpdateManyWithoutLanguageNestedInput
    CategoryTranslation?: CategoryTranslationUpdateManyWithoutLanguageNestedInput
  }

  export type LanguageUncheckedUpdateWithoutStatesInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUncheckedUpdateManyWithoutLanguageNestedInput
    CategoryTranslation?: CategoryTranslationUncheckedUpdateManyWithoutLanguageNestedInput
  }

  export type UserUpsertWithWhereUniqueWithoutStateInput = {
    where: UserWhereUniqueInput
    update: XOR<UserUpdateWithoutStateInput, UserUncheckedUpdateWithoutStateInput>
    create: XOR<UserCreateWithoutStateInput, UserUncheckedCreateWithoutStateInput>
  }

  export type UserUpdateWithWhereUniqueWithoutStateInput = {
    where: UserWhereUniqueInput
    data: XOR<UserUpdateWithoutStateInput, UserUncheckedUpdateWithoutStateInput>
  }

  export type UserUpdateManyWithWhereWithoutStateInput = {
    where: UserScalarWhereInput
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyWithoutStateInput>
  }

  export type UserCreateWithoutRoleInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    language?: LanguageCreateNestedOneWithoutUsersInput
    state?: StateCreateNestedOneWithoutUsersInput
  }

  export type UserUncheckedCreateWithoutRoleInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    languageId?: string | null
    stateId?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserCreateOrConnectWithoutRoleInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutRoleInput, UserUncheckedCreateWithoutRoleInput>
  }

  export type UserCreateManyRoleInputEnvelope = {
    data: UserCreateManyRoleInput | UserCreateManyRoleInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithWhereUniqueWithoutRoleInput = {
    where: UserWhereUniqueInput
    update: XOR<UserUpdateWithoutRoleInput, UserUncheckedUpdateWithoutRoleInput>
    create: XOR<UserCreateWithoutRoleInput, UserUncheckedCreateWithoutRoleInput>
  }

  export type UserUpdateWithWhereUniqueWithoutRoleInput = {
    where: UserWhereUniqueInput
    data: XOR<UserUpdateWithoutRoleInput, UserUncheckedUpdateWithoutRoleInput>
  }

  export type UserUpdateManyWithWhereWithoutRoleInput = {
    where: UserScalarWhereInput
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyWithoutRoleInput>
  }

  export type RoleCreateWithoutUsersInput = {
    roleId?: string
    name: $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type RoleUncheckedCreateWithoutUsersInput = {
    roleId?: string
    name: $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type RoleCreateOrConnectWithoutUsersInput = {
    where: RoleWhereUniqueInput
    create: XOR<RoleCreateWithoutUsersInput, RoleUncheckedCreateWithoutUsersInput>
  }

  export type LanguageCreateWithoutUsersInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    states?: StateCreateNestedManyWithoutLanguageInput
    CategoryTranslation?: CategoryTranslationCreateNestedManyWithoutLanguageInput
  }

  export type LanguageUncheckedCreateWithoutUsersInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    states?: StateUncheckedCreateNestedManyWithoutLanguageInput
    CategoryTranslation?: CategoryTranslationUncheckedCreateNestedManyWithoutLanguageInput
  }

  export type LanguageCreateOrConnectWithoutUsersInput = {
    where: LanguageWhereUniqueInput
    create: XOR<LanguageCreateWithoutUsersInput, LanguageUncheckedCreateWithoutUsersInput>
  }

  export type StateCreateWithoutUsersInput = {
    stateId?: string
    name: string
    createdAt?: Date | string
    updatedAt?: Date | string
    language: LanguageCreateNestedOneWithoutStatesInput
  }

  export type StateUncheckedCreateWithoutUsersInput = {
    stateId?: string
    name: string
    languageId: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StateCreateOrConnectWithoutUsersInput = {
    where: StateWhereUniqueInput
    create: XOR<StateCreateWithoutUsersInput, StateUncheckedCreateWithoutUsersInput>
  }

  export type RoleUpsertWithoutUsersInput = {
    update: XOR<RoleUpdateWithoutUsersInput, RoleUncheckedUpdateWithoutUsersInput>
    create: XOR<RoleCreateWithoutUsersInput, RoleUncheckedCreateWithoutUsersInput>
    where?: RoleWhereInput
  }

  export type RoleUpdateToOneWithWhereWithoutUsersInput = {
    where?: RoleWhereInput
    data: XOR<RoleUpdateWithoutUsersInput, RoleUncheckedUpdateWithoutUsersInput>
  }

  export type RoleUpdateWithoutUsersInput = {
    roleId?: StringFieldUpdateOperationsInput | string
    name?: EnumRoleNameFieldUpdateOperationsInput | $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleUncheckedUpdateWithoutUsersInput = {
    roleId?: StringFieldUpdateOperationsInput | string
    name?: EnumRoleNameFieldUpdateOperationsInput | $Enums.RoleName
    permissions?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LanguageUpsertWithoutUsersInput = {
    update: XOR<LanguageUpdateWithoutUsersInput, LanguageUncheckedUpdateWithoutUsersInput>
    create: XOR<LanguageCreateWithoutUsersInput, LanguageUncheckedCreateWithoutUsersInput>
    where?: LanguageWhereInput
  }

  export type LanguageUpdateToOneWithWhereWithoutUsersInput = {
    where?: LanguageWhereInput
    data: XOR<LanguageUpdateWithoutUsersInput, LanguageUncheckedUpdateWithoutUsersInput>
  }

  export type LanguageUpdateWithoutUsersInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    states?: StateUpdateManyWithoutLanguageNestedInput
    CategoryTranslation?: CategoryTranslationUpdateManyWithoutLanguageNestedInput
  }

  export type LanguageUncheckedUpdateWithoutUsersInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    states?: StateUncheckedUpdateManyWithoutLanguageNestedInput
    CategoryTranslation?: CategoryTranslationUncheckedUpdateManyWithoutLanguageNestedInput
  }

  export type StateUpsertWithoutUsersInput = {
    update: XOR<StateUpdateWithoutUsersInput, StateUncheckedUpdateWithoutUsersInput>
    create: XOR<StateCreateWithoutUsersInput, StateUncheckedCreateWithoutUsersInput>
    where?: StateWhereInput
  }

  export type StateUpdateToOneWithWhereWithoutUsersInput = {
    where?: StateWhereInput
    data: XOR<StateUpdateWithoutUsersInput, StateUncheckedUpdateWithoutUsersInput>
  }

  export type StateUpdateWithoutUsersInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    language?: LanguageUpdateOneRequiredWithoutStatesNestedInput
  }

  export type StateUncheckedUpdateWithoutUsersInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    languageId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryTranslationCreateWithoutCategoryInput = {
    translationId?: string
    displayName: string
    createdAt?: Date | string
    language: LanguageCreateNestedOneWithoutCategoryTranslationInput
  }

  export type CategoryTranslationUncheckedCreateWithoutCategoryInput = {
    translationId?: string
    languageId: string
    displayName: string
    createdAt?: Date | string
  }

  export type CategoryTranslationCreateOrConnectWithoutCategoryInput = {
    where: CategoryTranslationWhereUniqueInput
    create: XOR<CategoryTranslationCreateWithoutCategoryInput, CategoryTranslationUncheckedCreateWithoutCategoryInput>
  }

  export type CategoryTranslationCreateManyCategoryInputEnvelope = {
    data: CategoryTranslationCreateManyCategoryInput | CategoryTranslationCreateManyCategoryInput[]
    skipDuplicates?: boolean
  }

  export type CategoryTranslationUpsertWithWhereUniqueWithoutCategoryInput = {
    where: CategoryTranslationWhereUniqueInput
    update: XOR<CategoryTranslationUpdateWithoutCategoryInput, CategoryTranslationUncheckedUpdateWithoutCategoryInput>
    create: XOR<CategoryTranslationCreateWithoutCategoryInput, CategoryTranslationUncheckedCreateWithoutCategoryInput>
  }

  export type CategoryTranslationUpdateWithWhereUniqueWithoutCategoryInput = {
    where: CategoryTranslationWhereUniqueInput
    data: XOR<CategoryTranslationUpdateWithoutCategoryInput, CategoryTranslationUncheckedUpdateWithoutCategoryInput>
  }

  export type CategoryTranslationUpdateManyWithWhereWithoutCategoryInput = {
    where: CategoryTranslationScalarWhereInput
    data: XOR<CategoryTranslationUpdateManyMutationInput, CategoryTranslationUncheckedUpdateManyWithoutCategoryInput>
  }

  export type CategoryCreateWithoutTranslationsInput = {
    categoryId?: string
    key: string
    iconUrl?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CategoryUncheckedCreateWithoutTranslationsInput = {
    categoryId?: string
    key: string
    iconUrl?: string | null
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CategoryCreateOrConnectWithoutTranslationsInput = {
    where: CategoryWhereUniqueInput
    create: XOR<CategoryCreateWithoutTranslationsInput, CategoryUncheckedCreateWithoutTranslationsInput>
  }

  export type LanguageCreateWithoutCategoryTranslationInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    states?: StateCreateNestedManyWithoutLanguageInput
    users?: UserCreateNestedManyWithoutLanguageInput
  }

  export type LanguageUncheckedCreateWithoutCategoryTranslationInput = {
    languageId?: string
    name: string
    code: string
    isRTL?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    states?: StateUncheckedCreateNestedManyWithoutLanguageInput
    users?: UserUncheckedCreateNestedManyWithoutLanguageInput
  }

  export type LanguageCreateOrConnectWithoutCategoryTranslationInput = {
    where: LanguageWhereUniqueInput
    create: XOR<LanguageCreateWithoutCategoryTranslationInput, LanguageUncheckedCreateWithoutCategoryTranslationInput>
  }

  export type CategoryUpsertWithoutTranslationsInput = {
    update: XOR<CategoryUpdateWithoutTranslationsInput, CategoryUncheckedUpdateWithoutTranslationsInput>
    create: XOR<CategoryCreateWithoutTranslationsInput, CategoryUncheckedCreateWithoutTranslationsInput>
    where?: CategoryWhereInput
  }

  export type CategoryUpdateToOneWithWhereWithoutTranslationsInput = {
    where?: CategoryWhereInput
    data: XOR<CategoryUpdateWithoutTranslationsInput, CategoryUncheckedUpdateWithoutTranslationsInput>
  }

  export type CategoryUpdateWithoutTranslationsInput = {
    categoryId?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    iconUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryUncheckedUpdateWithoutTranslationsInput = {
    categoryId?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    iconUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LanguageUpsertWithoutCategoryTranslationInput = {
    update: XOR<LanguageUpdateWithoutCategoryTranslationInput, LanguageUncheckedUpdateWithoutCategoryTranslationInput>
    create: XOR<LanguageCreateWithoutCategoryTranslationInput, LanguageUncheckedCreateWithoutCategoryTranslationInput>
    where?: LanguageWhereInput
  }

  export type LanguageUpdateToOneWithWhereWithoutCategoryTranslationInput = {
    where?: LanguageWhereInput
    data: XOR<LanguageUpdateWithoutCategoryTranslationInput, LanguageUncheckedUpdateWithoutCategoryTranslationInput>
  }

  export type LanguageUpdateWithoutCategoryTranslationInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    states?: StateUpdateManyWithoutLanguageNestedInput
    users?: UserUpdateManyWithoutLanguageNestedInput
  }

  export type LanguageUncheckedUpdateWithoutCategoryTranslationInput = {
    languageId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    code?: StringFieldUpdateOperationsInput | string
    isRTL?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    states?: StateUncheckedUpdateManyWithoutLanguageNestedInput
    users?: UserUncheckedUpdateManyWithoutLanguageNestedInput
  }

  export type StateCreateManyLanguageInput = {
    stateId?: string
    name: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserCreateManyLanguageInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    roleId: string
    stateId?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CategoryTranslationCreateManyLanguageInput = {
    translationId?: string
    categoryId: string
    displayName: string
    createdAt?: Date | string
  }

  export type StateUpdateWithoutLanguageInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUpdateManyWithoutStateNestedInput
  }

  export type StateUncheckedUpdateWithoutLanguageInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUncheckedUpdateManyWithoutStateNestedInput
  }

  export type StateUncheckedUpdateManyWithoutLanguageInput = {
    stateId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUpdateWithoutLanguageInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    role?: RoleUpdateOneRequiredWithoutUsersNestedInput
    state?: StateUpdateOneWithoutUsersNestedInput
  }

  export type UserUncheckedUpdateWithoutLanguageInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: StringFieldUpdateOperationsInput | string
    stateId?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyWithoutLanguageInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: StringFieldUpdateOperationsInput | string
    stateId?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryTranslationUpdateWithoutLanguageInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutTranslationsNestedInput
  }

  export type CategoryTranslationUncheckedUpdateWithoutLanguageInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    categoryId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryTranslationUncheckedUpdateManyWithoutLanguageInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    categoryId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateManyStateInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    roleId: string
    languageId?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateWithoutStateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    role?: RoleUpdateOneRequiredWithoutUsersNestedInput
    language?: LanguageUpdateOneWithoutUsersNestedInput
  }

  export type UserUncheckedUpdateWithoutStateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: StringFieldUpdateOperationsInput | string
    languageId?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyWithoutStateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    roleId?: StringFieldUpdateOperationsInput | string
    languageId?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateManyRoleInput = {
    userId?: string
    mobileNumber: string
    mpin: string
    deviceId?: string | null
    fcmToken?: string | null
    languageId?: string | null
    stateId?: string | null
    isVerified?: boolean
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateWithoutRoleInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    language?: LanguageUpdateOneWithoutUsersNestedInput
    state?: StateUpdateOneWithoutUsersNestedInput
  }

  export type UserUncheckedUpdateWithoutRoleInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    languageId?: NullableStringFieldUpdateOperationsInput | string | null
    stateId?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyWithoutRoleInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mobileNumber?: StringFieldUpdateOperationsInput | string
    mpin?: StringFieldUpdateOperationsInput | string
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null
    fcmToken?: NullableStringFieldUpdateOperationsInput | string | null
    languageId?: NullableStringFieldUpdateOperationsInput | string | null
    stateId?: NullableStringFieldUpdateOperationsInput | string | null
    isVerified?: BoolFieldUpdateOperationsInput | boolean
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryTranslationCreateManyCategoryInput = {
    translationId?: string
    languageId: string
    displayName: string
    createdAt?: Date | string
  }

  export type CategoryTranslationUpdateWithoutCategoryInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    language?: LanguageUpdateOneRequiredWithoutCategoryTranslationNestedInput
  }

  export type CategoryTranslationUncheckedUpdateWithoutCategoryInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    languageId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryTranslationUncheckedUpdateManyWithoutCategoryInput = {
    translationId?: StringFieldUpdateOperationsInput | string
    languageId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}