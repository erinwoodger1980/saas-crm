export type SqlQueryOutput = {
    name: string;
    source: string;
    documentation: string | null;
    parameters: SqlQueryParameterOutput[];
    resultColumns: SqlQueryColumnOutput[];
};
export type SqlQueryParameterOutput = {
    name: string;
    typ: QueryIntrospectionType;
    documentation: string | null;
    nullable: boolean;
};
export type SqlQueryColumnOutput = {
    name: string;
    typ: QueryIntrospectionType;
    nullable: boolean;
};
export type QueryIntrospectionType = QueryIntrospectionBuiltinType | (string & {});
export type QueryIntrospectionBuiltinType = 'int' | 'bigint' | 'float' | 'double' | 'string' | 'enum' | 'bytes' | 'bool' | 'char' | 'decimal' | 'json' | 'xml' | 'uuid' | 'datetime' | 'date' | 'time' | 'int-array' | 'bigint-array' | 'float-array' | 'double-array' | 'string-array' | 'char-array' | 'bytes-array' | 'bool-array' | 'decimal-array' | 'json-array' | 'xml-array' | 'uuid-array' | 'datetime-array' | 'date-array' | 'time-array' | 'null' | 'unknown';
