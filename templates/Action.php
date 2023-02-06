    /**
     * {controller-action-description}
     * @param RequestCollection $get данные GET
     * @param RequestCollection $post данные POST
     * @param mixed $payload данные payload обьекта переданного через POST/PUT
     * @return object
     */
    public function {controller-action-name}(RequestCollection $get, RequestCollection $post, ? PayloadCopy $payload = null): object
    {

        $result = [];
        $message = 'Result message';
        try {
            
            

        } catch (\Throwable $e) {
            // если что то не так то выводим ошибку
            $message = $e->getMessage() . ' ' . $e->getFile() . ' ' . $e->getLine();
            App::$log->debug($message);
        }

        // финишируем контроллер
        return $this->Finish(
            200,
            $message,
            $result,
            'utf-8'
        );

    }


    