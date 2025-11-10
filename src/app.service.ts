import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';



@Injectable()
export class AppService {
  private readonly logger = new Logger("AppService");
  constructor(
              private readonly httpClient: HttpService,
              private readonly config: ConfigService,
  ) {}
  
  getHello(): string {
    this.logger.log('Getting hello message');
    return 'Hello World! v2';
  }
  async makeTestCall(): Promise<unknown> {
    const url = 'http://localhost:4001/test'; // hier deine echte API-URL
    // wenn Base URL gesetzt dann:
    // const res = await firstValueFrom(this.httpClient.get('/test'));

    try {
      this.logger.debug(`Sending test request to ${url}`);

      const response = await firstValueFrom(
        this.httpClient.get(url, {
          // optional:
          // params: { foo: 'bar' },
          // headers: { 'Authorization': 'Bearer ...' },
        }),
      );

      // response ist ein AxiosResponse
      // du kannst zurückgeben, was du willst:
      return {
        status: response.status,
        data: response.data,
      };
    } catch (error: any) {
      // bisschen saubere Fehlerausgabe
      if (error.response) {
        this.logger.error(
          `CustomAPI API error: ${error.response.status} ${JSON.stringify(error.response.data)}`,
        );
        return {
          status: error.response.status,
          error: error.response.data,
        };
      }

      this.logger.error(`Request failed: ${error.message}`);
      throw error; // oder HttpException, wenn du es hübscher willst
    }
  }
  async refreshToken(): Promise<string> {
    const url = 'https://ion.tdsynnex.com/oauth/token';

    const refreshToken = this.config.get<string>('ION_REFRESH_TOKEN');
    if (!refreshToken) {
      this.logger.error('No ION_REFRESH_TOKEN found in env');
      throw new Error('Missing refresh token');
    }

    const body = new URLSearchParams();
    body.append('grant_type', 'refresh_token');
    body.append('redirect_url', 'http://localhost/');
    body.append('refresh_token', refreshToken);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };

    try {
      this.logger.debug(`Refreshing access token via ${url}`);
      const response = await firstValueFrom(
        this.httpClient.post(url, body.toString(), { headers }),
      );

      const newAccessToken = response.data?.access_token;
      if (!newAccessToken) {
        this.logger.error(
          `No access_token in refresh response: ${JSON.stringify(response.data)}`,
        );
        throw new Error('No access_token in response');
      }

      return newAccessToken;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(
          `Token refresh error: ${error.response.status} ${JSON.stringify(error.response.data)}`,
        );
      } else {
        this.logger.error(`Token refresh failed: ${error.message}`);
      }
      throw error;
    }
  }

  async getCustomers(accessToken: string, retry = true): Promise<unknown> {
    const accountId = this.config.get<string>('ION_ACCOUNT_ID') ?? '10718';
    const baseUrl = this.config.get<string>('ION_BASE_URL') ?? 'https://ion.tdsynnex.com';

    const url = `${baseUrl}/api/v3/accounts/${accountId}/customers`;

    const params = {
      pageSize: 100,
    };

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    try {
      this.logger.debug(`Sending customers request to ${url}`);
      const response = await firstValueFrom(
        this.httpClient.get(url, { headers, params }),
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(
          `CustomAPI API error: ${error.response.status} ${JSON.stringify(error.response.data)}`,
        );

        // 401 → Access-Token abgelaufen → Refresh versuchen
        if (error.response.status === 401 && retry) {
          this.logger.warn('401 Unauthorized. Trying to refresh access token...');

          const newAccessToken = await this.refreshToken();

          // optional: neuen Token irgendwo speichern
          // z.B. in DB, Cache, etc.

          // Einmaliger Retry mit neuem Token
          return this.getCustomers(newAccessToken, false);
        }

        return {
          status: error.response.status,
          error: error.response.data,
        };
      }

      this.logger.error(`Request failed: ${error.message}`);
      throw error;
    }
  }
}

