export const toFloat = (s: string): number | null => {
  try {
    const n = parseFloat(s);
    return n === n ? n : null;
  } catch (e) {
    return null;
  }
};

export const toInt = (s: string): number | null => {
  try {
    const n = parseInt(s);
    return n === n ? n : null;
  } catch (e) {
    return null;
  }
};

export const mergeArray = <T>(
  prev: T[],
  next: T[] | null | undefined,
  idName: string,
): T[] => {
  if (!next?.length) return prev;

  const dest = prev.slice();
  for (let i = 0, l = next.length; i < l; i += 1) {
    const item = next[i];
    const id = item[idName];

    let found = false;
    for (let j = 0, jl = dest.length; j < jl; j += 1) {
      const prevItem = dest[j];
      if (prevItem[idName] === id) {
        found = true;
        dest[j] = { ...prevItem, ...item };
      }
    }

    if (!found) {
      dest.push(item);
    }
  }

  return dest;
};
