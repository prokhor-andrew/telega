export type Option<T> = {
    kind: "some"
    value: T
} | { kind: "none" }

export function none<T>(): Option<T> {
    return {
        kind: "none"
    }
}

export function some<T>(value: T): Option<T> {
    return {
        kind: "some",
        value: value,
    }
}

export function match<T, R>(
    option: Option<T>,
    args: {
        ifNone: () => R, 
        ifSome: (value: T) => R, 
    },
): R {
    if (option.kind === "some") {
        return args.ifSome(option.value);
    } else {
        return args.ifNone();
    }
}

export function run<T>(
    option: Option<T>,
    args: {
        ifNone: () => void,
        ifSome: (value: T) => void,
    }
) {
    if (option.kind === "some") {
        args.ifSome(option.value);
    } else {
        args.ifNone()
    }
}

