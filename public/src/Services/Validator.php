<?php
class Validator {
    public static function string($value, $maxLen = 255) {
        $string = trim((string) $value);
        $string = preg_replace('/[[:cntrl:]]/', '', $string);

        if ($maxLen !== null) {
            $string = mb_substr($string, 0, (int) $maxLen);
        }

        return $string;
    }

    public static function login($value) {
        return strtolower(self::string($value, 180));
    }
}
