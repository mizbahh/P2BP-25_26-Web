/** Date formatting/parsing ported from PrimeNG's DatePicker (jQuery-UI datepicker heritage). */

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_MIN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TICKS_TO_1970 = ((1970 - 1) * 365 + Math.floor(1970 / 4) - Math.floor(1970 / 100) + Math.floor(1970 / 400)) * 24 * 60 * 60 * 10000000;

export function formatDate(date: Date | null | undefined, format: string): string {
  if (!date) return "";
  let i = 0;
  const lookAhead = (match: string) => {
    const matches = i + 1 < format.length && format.charAt(i + 1) === match;
    if (matches) i++;
    return matches;
  };
  const formatNumber = (match: string, value: number, len: number) => {
    let num = "" + value;
    if (lookAhead(match)) while (num.length < len) num = "0" + num;
    return num;
  };
  const formatName = (match: string, value: number, shortNames: string[], longNames: string[]) => (lookAhead(match) ? longNames[value] : shortNames[value]);
  let out = "";
  let literal = false;
  for (i = 0; i < format.length; i++) {
    const ch = format.charAt(i);
    if (literal) {
      if (ch === "'" && !lookAhead("'")) literal = false;
      else out += ch;
      continue;
    }
    switch (ch) {
      case "d":
        out += formatNumber("d", date.getDate(), 2);
        break;
      case "D":
        out += formatName("D", date.getDay(), DAY_NAMES_SHORT, DAY_NAMES);
        break;
      case "o":
        out += formatNumber(
          "o",
          Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000),
          3,
        );
        break;
      case "m":
        out += formatNumber("m", date.getMonth() + 1, 2);
        break;
      case "M":
        out += formatName("M", date.getMonth(), MONTH_NAMES_SHORT, MONTH_NAMES);
        break;
      case "y":
        out += lookAhead("y") ? date.getFullYear() : (date.getFullYear() % 100 < 10 ? "0" : "") + (date.getFullYear() % 100);
        break;
      case "@":
        out += date.getTime();
        break;
      case "!":
        out += date.getTime() * 10000 + TICKS_TO_1970;
        break;
      case "'":
        if (lookAhead("'")) out += "'";
        else literal = true;
        break;
      default:
        out += ch;
    }
  }
  return out;
}

export function parseDate(value: string, format: string, shortYearCutoff: string | number = "+10"): Date {
  if (format == null || value == null) throw "Invalid arguments";
  value = typeof value === "object" ? String(value) : value + "";
  if (value === "") return null as unknown as Date;
  let iFormat: number;
  let dim: number;
  let extra: number;
  let iValue = 0;
  const cutoff = typeof shortYearCutoff !== "string" ? shortYearCutoff : (new Date().getFullYear() % 100) + parseInt(shortYearCutoff, 10);
  let year = -1;
  let month = -1;
  let day = -1;
  let doy = -1;
  let literal = false;
  let date: Date;
  const lookAhead = (match: string) => {
    const matches = iFormat + 1 < format.length && format.charAt(iFormat + 1) === match;
    if (matches) iFormat++;
    return matches;
  };
  const getNumber = (match: string) => {
    const isDoubled = lookAhead(match);
    const size = match === "@" ? 14 : match === "!" ? 20 : match === "y" && isDoubled ? 4 : match === "o" ? 3 : 2;
    const minSize = match === "y" ? size : 1;
    const digits = new RegExp("^\\d{" + minSize + "," + size + "}");
    const num = value.substring(iValue).match(digits);
    if (!num) throw "Missing number at position " + iValue;
    iValue += num[0].length;
    return parseInt(num[0], 10);
  };
  const getName = (match: string, shortNames: string[], longNames: string[]) => {
    let index = -1;
    const arr = lookAhead(match) ? longNames : shortNames;
    const names: [number, string][] = [];
    for (let i = 0; i < arr.length; i++) names.push([i, arr[i]]);
    names.sort((a, b) => -(a[1].length - b[1].length));
    for (let i = 0; i < names.length; i++) {
      const name = names[i][1];
      if (value.substr(iValue, name.length).toLowerCase() === name.toLowerCase()) {
        index = names[i][0];
        iValue += name.length;
        break;
      }
    }
    if (index !== -1) return index + 1;
    throw "Unknown name at position " + iValue;
  };
  const checkLiteral = () => {
    if (value.charAt(iValue) !== format.charAt(iFormat)) throw "Unexpected literal at position " + iValue;
    iValue++;
  };
  if (format.includes("y")) {
    /* noop: year handled below */
  }
  for (iFormat = 0; iFormat < format.length; iFormat++) {
    if (literal) {
      if (format.charAt(iFormat) === "'" && !lookAhead("'")) literal = false;
      else checkLiteral();
    } else {
      switch (format.charAt(iFormat)) {
        case "d":
          day = getNumber("d");
          break;
        case "D":
          getName("D", DAY_NAMES_SHORT, DAY_NAMES);
          break;
        case "o":
          doy = getNumber("o");
          break;
        case "m":
          month = getNumber("m");
          break;
        case "M":
          month = getName("M", MONTH_NAMES_SHORT, MONTH_NAMES);
          break;
        case "y":
          year = getNumber("y");
          break;
        case "@":
          date = new Date(getNumber("@"));
          year = date.getFullYear();
          month = date.getMonth() + 1;
          day = date.getDate();
          break;
        case "!":
          date = new Date((getNumber("!") - TICKS_TO_1970) / 10000);
          year = date.getFullYear();
          month = date.getMonth() + 1;
          day = date.getDate();
          break;
        case "'":
          if (lookAhead("'")) checkLiteral();
          else literal = true;
          break;
        default:
          checkLiteral();
      }
    }
  }
  if (iValue < value.length) {
    extra = iValue;
    if (value.substr(extra).trim() !== "") throw "Extra/unparsed characters found in date: " + value.substr(extra);
  }
  if (year === -1) year = new Date().getFullYear();
  else if (year < 100) year += new Date().getFullYear() - (new Date().getFullYear() % 100) + (year <= cutoff ? 0 : -100);
  if (doy > -1) {
    month = 1;
    day = doy;
    do {
      dim = 32 - new Date(year, month - 1, 32).getDate();
      if (day <= dim) break;
      month++;
      day -= dim;
    } while (true);
  }
  date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) throw "Invalid date";
  return date;
}

export function formatTime(date: Date, hourFormat: "12" | "24", showSeconds: boolean): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  if (hourFormat === "12" && hours > 11 && hours !== 12) hours -= 12;
  let out = "";
  if (hourFormat === "12") out += hours === 0 ? 12 : hours < 10 ? "0" + hours : hours;
  else out += hours < 10 ? "0" + hours : hours;
  out += ":" + (minutes < 10 ? "0" + minutes : minutes);
  if (showSeconds) out += ":" + (seconds < 10 ? "0" + seconds : seconds);
  if (hourFormat === "12") out += date.getHours() > 11 ? " PM" : " AM";
  return out;
}
