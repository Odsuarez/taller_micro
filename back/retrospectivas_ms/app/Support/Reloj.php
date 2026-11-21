<?php

declare(strict_types=1);

namespace App\Support;

final class Reloj
{
    public static function hoy(): string
    {
        return (new \DateTimeImmutable('today', new \DateTimeZone(date_default_timezone_get())))->format('Y-m-d');
    }
}
