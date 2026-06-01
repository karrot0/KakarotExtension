export const enum HitomiErrorCode {
  INVALID_VALUE,
  INVALID_CALL,
  DUPLICATED_ELEMENT,
  LACK_OF_ELEMENT,
  REQEUST_REJECTED,
}

export class HitomiError extends Error {
  constructor(code: HitomiErrorCode, ...values: string[]) {
    switch (code) {
      case HitomiErrorCode.INVALID_VALUE: {
        super(
          `${values[0]} must ${values.length === 1 ? "be valid" : values[1]}`,
        );
        this.name = "INVALID_VALUE";
        break;
      }
      case HitomiErrorCode.INVALID_CALL: {
        super(`${values[0]} must ${values[1]}`);
        this.name = "INVALID_CALL";
        break;
      }
      case HitomiErrorCode.DUPLICATED_ELEMENT: {
        super(`${values[0]} must not be duplicated`);
        this.name = "DUPLICATED_ELEMENT";
        break;
      }
      case HitomiErrorCode.LACK_OF_ELEMENT: {
        super(`${values[0]} must have more elements`);
        this.name = "LACK_OF_ELEMENT";
        break;
      }
      case HitomiErrorCode.REQEUST_REJECTED: {
        super(`Request to '${values[0].replace(/'/g, "\\'")}' was rejected`);
        this.name = "REQEUST_REJECTED";
        break;
      }
      default: {
        super("Unknown error");
        this.name = "UNKNOWN";
      }
    }
    this.name = `HitomiError [${this.name}]`;
  }
}

export function getIdSet(
  buffer: ArrayBuffer,
  isNegative = false,
): Set<number> & { isNegative?: boolean } {
  const integers = new Set<number>() as Set<number> & { isNegative?: boolean };
  const view = new DataView(buffer);
  integers.isNegative = isNegative;
  const length = Math.floor(buffer.byteLength / 4) * 4;
  for (let i = 0; i < length; i += 4) {
    integers.add(view.getInt32(i, false));
  }
  return integers;
}
