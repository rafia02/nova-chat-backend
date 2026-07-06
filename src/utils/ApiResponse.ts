export class ApiResponse {
  constructor(
    public statusCode: number,

    public message: string,

    public data: any = null,
  ) {}
}
