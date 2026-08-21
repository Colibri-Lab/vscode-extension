    /**
     * {controller-action-description}
     * @public
     * @param RequestCollection $get RequestCollection containing GET data
     * @param RequestCollection $post RequestCollection containing POST data
     * @param ?PayloadCopy $payload Request payload data as PayloadCopy object
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


    