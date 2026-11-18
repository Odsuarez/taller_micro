<?php
declare(strict_types=1);
namespace App\Support;
use App\Exceptions\ApiException;
final class Validar {
    public static function id(mixed $id): int {
        if ((!is_int($id) && !is_string($id)) || !preg_match('/^[1-9][0-9]*$/D',(string)$id) || filter_var($id,FILTER_VALIDATE_INT)===false) self::error('El identificador debe ser un entero positivo.');
        return (int)$id;
    }
    public static function texto(mixed $valor, string $campo, int $max = 2000): string {
        if (!is_string($valor) || trim($valor)==='' || mb_strlen(trim($valor))>$max) self::error("El campo $campo debe contener entre 1 y $max caracteres.");
        return trim($valor);
    }
    public static function fecha(mixed $valor, string $campo): string {
        if (!is_string($valor) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D',$valor)) self::error("La fecha $campo debe tener formato AAAA-MM-DD.");
        $d=\DateTimeImmutable::createFromFormat('!Y-m-d',$valor);
        if (!$d || $d->format('Y-m-d')!==$valor) self::error("La fecha $campo no es válida.");
        return $valor;
    }
    public static function textos(mixed $valores, string $campo): array {
        if (!is_array($valores) || !array_is_list($valores) || count($valores)>100) self::error("$campo debe ser una lista con un máximo de 100 elementos.");
        return array_values(array_unique(array_map(fn($v)=>self::texto($v,$campo),$valores)));
    }
    public static function ids(mixed $ids, string $campo): array {
        if (!is_array($ids) || !array_is_list($ids) || count($ids)>100) self::error("$campo debe ser una lista de identificadores.");
        return array_values(array_unique(array_map([self::class,'id'],$ids)));
    }
    public static function booleano(mixed $valor, string $campo): bool {
        if (!is_bool($valor)) self::error("$campo debe ser true o false.");
        return $valor;
    }
    public static function error(string $mensaje): never { throw new ApiException(422,'DATOS_INVALIDOS',$mensaje); }
}
