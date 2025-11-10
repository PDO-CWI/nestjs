import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService,
              private readonly config: ConfigService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get("test")
  makeTestCall(): Promise<unknown> {
    return this.appService.makeTestCall();
  }
  @Post("refresh")
  refreshToken(): Promise<unknown> {
    return this.appService.refreshToken();
  }
  @Get("Customers")
  getCustomers(): Promise<unknown> {
    const TOKEN = this.config.get<string>('ION_ACCESS_TOKEN');
    if (!TOKEN) {
      throw new Error("ION_ACCESS_TOKEN is not set in environment variables");
    }
    return this.appService.getCustomers(TOKEN);
  }
}
