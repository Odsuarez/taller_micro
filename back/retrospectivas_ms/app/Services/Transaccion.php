<?php
declare(strict_types=1);
namespace App\Services;
use App\Exceptions\ApiException;
use Illuminate\Database\Capsule\Manager as DB;
final class Transaccion {
    public static function ejecutar(callable $operation): mixed {
        $db=DB::connection(); $mysql=$db->getDriverName()==='mysql';
        if ($mysql && (int)$db->selectOne("SELECT GET_LOCK('registro_retro_flujo',10) AS adquirido")->adquirido!==1) {
            throw new ApiException(409,'OPERACION_EN_CURSO','Hay otra operación en curso. Intenta nuevamente.');
        }
        try { return $db->transaction($operation); }
        finally { if ($mysql) $db->select("SELECT RELEASE_LOCK('registro_retro_flujo')"); }
    }
}
