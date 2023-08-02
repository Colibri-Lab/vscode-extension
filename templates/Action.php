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
        $code = 200;

        // todo 
            
        return $this->Finish(
            $code,
            $message,
            $result,
            'utf-8'
        );

    }


    