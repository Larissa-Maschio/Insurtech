import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsCpf } from '../common/validators/cpf';

const onlyDigits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MSG =
  'A senha precisa ter de 8 a 72 caracteres, com letras e números';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Souza' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(3, 120)
  name!: string;

  @ApiProperty({ example: 'maria@exemplo.com' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'E-mail inválido' })
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: '529.982.247-25' })
  @Transform(onlyDigits)
  @IsCpf()
  cpf!: string;

  @ApiProperty({ example: '(11) 98765-4321' })
  @Transform(onlyDigits)
  @Matches(/^\d{10,11}$/, { message: 'Telefone inválido' })
  phone!: string;

  @ApiProperty({ example: 'senhaSegura1' })
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password!: string;

  @ApiProperty({
    example: true,
    description: 'Aceite dos termos de uso e da política de privacidade (LGPD)',
  })
  @IsBoolean()
  @Equals(true, {
    message: 'É preciso aceitar os termos de uso e a política de privacidade',
  })
  acceptTerms!: boolean;
}

export class LoginDto {
  @ApiProperty({ example: 'maria@exemplo.com' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @ApiProperty({ example: 'senhaSegura1' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(trimLower)
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password!: string;
}
