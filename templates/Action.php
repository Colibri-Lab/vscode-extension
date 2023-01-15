    /**
     * {controller-action-description}
     * @param RequestCollection $get данные GET
     * @param RequestCollection $post данные POST
     * @param mixed $payload данные payload обьекта переданного через POST/PUT
     * @return object
     */
    public function {controller-action-name}(RequestCollection $get, RequestCollection $post, ? PayloadCopy $payload = null): object
    {

        try {
            
            

        } catch (\Throwable $e) {
            // если что то не так то выводим ошибку
            $html = $e->getMessage() . ' ' . $e->getFile() . ' ' . $e->getLine();
        }

        // финишируем контроллер
        return $this->Finish(
            200,
            'Result message',
            [],
            'utf-8'
        );

    }


    