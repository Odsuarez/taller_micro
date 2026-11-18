<?php
declare(strict_types=1);
namespace App\Support;
use App\Exceptions\ApiException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
final class Json {
    public static function response(ResponseInterface $response, array $data, int $status = 200): ResponseInterface {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
        return $response->withHeader('Content-Type','application/json; charset=utf-8')->withStatus($status);
    }
    public static function ok(ResponseInterface $response, mixed $data, int $status = 200): ResponseInterface {
        return self::response($response,['ok'=>true,'data'=>$data],$status);
    }
    public static function body(ServerRequestInterface $request): array {
        $type=strtolower(trim(explode(';',$request->getHeaderLine('Content-Type'))[0]));
        if ($type!=='application/json') throw new ApiException(415,'TIPO_NO_ADMITIDO','Envía el cuerpo con Content-Type: application/json.');
        $raw=(string)$request->getBody();
        if (strlen($raw)>1000000) throw new ApiException(413,'CUERPO_GRANDE','El cuerpo de la petición es demasiado grande.');
        try { $object=json_decode($raw,false,512,JSON_THROW_ON_ERROR); }
        catch (\JsonException) { throw new ApiException(400,'JSON_INVALIDO','El cuerpo no contiene JSON válido.'); }
        if (!$object instanceof \stdClass) throw new ApiException(400,'JSON_INVALIDO','El cuerpo debe ser un objeto JSON.');
        return json_decode($raw,true,512,JSON_THROW_ON_ERROR);
    }
}
