/**
 * Minimal in-memory stand-in for the subset of the Firestore Admin SDK this
 * server actually uses (doc get/set/update/delete, collection scans, a single
 * `where(field, "==", value)` clause, subcollections via docRef.collection(),
 * and runTransaction). Good enough to unit-test service logic (membership
 * bootstrap, id-generation) without real Firestore credentials.
 */

interface DocSnapshot {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

export class FakeFirestore {
  private docs = new Map<string, Record<string, unknown>>();
  private idCounter = 0;

  private childKeys(path: string): string[] {
    const prefix = `${path}/`;
    return Array.from(this.docs.keys()).filter(
      (key) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"),
    );
  }

  collection(path: string) {
    return this.collectionRef(path);
  }

  private collectionRef(path: string) {
    const snapshotFor = (): DocSnapshot[] =>
      this.childKeys(path).map((key) => {
        const id = key.slice(path.length + 1);
        return { id, exists: true, data: () => this.docs.get(key) };
      });

    return {
      doc: (id?: string) => this.docRef(path, id ?? `auto-${++this.idCounter}`),
      get: async () => ({ docs: snapshotFor() }),
      where: (field: string, _op: "==", value: unknown) => {
        const filtered = () => snapshotFor().filter((s) => s.data()?.[field] === value);
        return {
          get: async () => ({ docs: filtered() }),
          limit: (_n: number) => ({
            get: async () => {
              const docs = filtered().slice(0, _n);
              return { empty: docs.length === 0, docs };
            },
          }),
        };
      },
    };
  }

  private docRef(collectionPath: string, id: string) {
    const fullPath = `${collectionPath}/${id}`;
    const self = this;
    return {
      id,
      _path: fullPath,
      get: async (): Promise<DocSnapshot> => {
        const data = self.docs.get(fullPath);
        return { id, exists: data !== undefined, data: () => data };
      },
      set: async (data: Record<string, unknown>) => {
        self.docs.set(fullPath, { ...data });
      },
      update: async (patch: Record<string, unknown>) => {
        const existing = self.docs.get(fullPath) ?? {};
        self.docs.set(fullPath, { ...existing, ...patch });
      },
      delete: async () => {
        self.docs.delete(fullPath);
      },
      collection: (name: string) => self.collectionRef(`${fullPath}/${name}`),
    };
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this.docs);
    return fn(tx);
  }

  /** Test helper: read a doc's raw stored data directly by path, e.g. "projects/abc/members/u1". */
  peek(path: string): Record<string, unknown> | undefined {
    return this.docs.get(path);
  }
}

class FakeTransaction {
  constructor(private docs: Map<string, Record<string, unknown>>) {}

  set(ref: { _path: string }, data: Record<string, unknown>) {
    this.docs.set(ref._path, { ...data });
  }

  update(ref: { _path: string }, patch: Record<string, unknown>) {
    const existing = this.docs.get(ref._path) ?? {};
    this.docs.set(ref._path, { ...existing, ...patch });
  }
}
