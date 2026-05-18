<?php
class Validator {
    public static function string($value, $maxLen = 255) {
        $string = trim((string) $value);
        $string = preg_replace('/[[:cntrl:]]/', '', $string);

        if ($maxLen !== null) {
            if (function_exists('mb_substr')) {
                $string = mb_substr($string, 0, (int) $maxLen);
            } else {
                $string = substr($string, 0, (int) $maxLen);
            }
        }

        return $string;
    }

    public static function username($value, $maxLen = 64) {
        $string = self::string($value, $maxLen);
        $string = strtolower($string);
        return $string;
    }
}
