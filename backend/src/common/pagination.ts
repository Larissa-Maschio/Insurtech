import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  get skip() {
    return (this.page - 1) * this.pageSize;
  }
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function paginated<T>(
  data: T[],
  total: number,
  q: PaginationQuery,
): Paginated<T> {
  return {
    data,
    meta: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    },
  };
}
