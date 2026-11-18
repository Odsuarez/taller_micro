<?php
declare(strict_types=1);
namespace App\Exceptions;
use RuntimeException;
final class ApiException extends RuntimeException {
    public function __construct(public readonly int $status, public readonly string $codigo, string $mensaje, public readonly array $detalles = []) {
        parent::__construct($mensaje);
    }
}
