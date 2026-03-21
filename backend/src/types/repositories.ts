export interface RepositoryCreate<T> {
  create(data: T): Promise<T>;
}

export interface RepositoryRead<T> {
  findAll(): Promise<T[]>;
  findById(id: number): Promise<T | null>;
}

export interface RepositoryUpdate<T, TUpdate> {
  update(id: number, data: TUpdate): Promise<T | null>;
}

export interface RepositoryDelete {
  delete(id: number): Promise<boolean>;
}

export type CrudRepository<T, TUpdate = Partial<T>> = RepositoryCreate<T> & RepositoryRead<T> & RepositoryUpdate<T, TUpdate> & RepositoryDelete;
