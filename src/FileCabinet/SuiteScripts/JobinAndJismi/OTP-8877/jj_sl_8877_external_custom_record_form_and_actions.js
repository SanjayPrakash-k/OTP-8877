/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/email', 'N/log', 'N/record', 'N/search', 'N/url', 'N/ui/serverWidget'],
    /**
 * @param{email} email
 * @param{log} log
 * @param{record} record
 * @param{search} search
 * @param{url} url
 * @param{serverWidget} serverWidget
 */
    (email, log, record, search, url, serverWidget) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            if(scriptContext.request.method === 'GET'){
                try{
                    let form = serverWidget.createForm({
                        title: 'Customer Communication Form'
                    });

                    form.addField({
                        id: 'custpage_name',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Name'
                    });

                    form.addField({
                        id: 'custpage_email',
                        type: serverWidget.FieldType.EMAIL,
                        label: 'Email'
                    });

                    form.addField({
                        id: 'custpage_subject',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Subject'
                    });

                    form.addField({
                        id: 'custpage_message',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Message'
                    });

                    form.addSubmitButton({
                        label: 'Submit'
                    });

                    scriptContext.response.writePage({
                        pageObject: form
                    });

                } catch(error) {
                    log.debug('Unexpected error occured', error.message);
                }
            } else {
                try{
                    let name = scriptContext.request.parameters.custpage_name;
                    let customerEmail = scriptContext.request.parameters.custpage_email || 'empty';
                    let subject = scriptContext.request.parameters.custpage_subject;
                    let message = scriptContext.request.parameters.custpage_message;

                    searchAndCheckCustomerEmail(customerEmail);

                    function searchAndCheckCustomerEmail(customerEmail){
                        let customerSearch = search.create({
                            type: search.Type.CUSTOMER,
                            title: 'Existing Customers and Email JJ',
                            id: 'customsearch_jj_existing_customer_email',

                            filters: [
                                ["email", "is", customerEmail]
                            ],

                            columns: [
                                {name: "internalid"},
                                {name: "entityid"},
                                {name: "altname"},
                                {name: "email"},
                                {name: "email", join: 'salesRep'}
                            ]
                        });
                        let searchResult = customerSearch.run().getRange({ start: 0, end: 5 });

                        if(searchResult.length === 0){
                            createCustomRecord('', customerEmail, '');
                        } else {
                            searchResult.forEach(function(result){
                                let internalId = result.getValue('internalid');
                                let customerEmail = result.getValue('email');
                                let salesRepEmail = result.getValue({name: "email", join: 'salesRep'});

                                createCustomRecord(internalId, customerEmail, salesRepEmail);
                            });
                        }
                    }

                    function createCustomRecord(internalId, customerEmail, salesRepEmail) {
                        let externalCustomerRecord = record.create({
                            type: 'customrecord_jj_external_customer_cmtn',
                            isDynamic: true
                        });

                        let customerUrl;
                        if(internalId !== ''){
                            customerUrl = url.resolveRecord({
                                recordType: 'customer',
                                recordId: internalId,
                                isEditMode: false
                            });
                        }

                        externalCustomerRecord.setValue({
                            fieldId: 'name',
                            value: name,
                            ignoreFieldChange: true
                        });

                        externalCustomerRecord.setValue({
                            fieldId: 'custrecord_jj_customer_reference',
                            value: customerUrl || '',
                            ignoreFieldChange: true
                        });

                        externalCustomerRecord.setValue({
                            fieldId: 'custrecord_jj_email',
                            value: customerEmail,
                            ignoreFieldChange: true
                        });

                        externalCustomerRecord.setValue({
                            fieldId: 'custrecord_jj_subject_',
                            value: subject,
                            ignoreFieldChange: true
                        });

                        externalCustomerRecord.setValue({
                            fieldId: 'custrecord_jj_message_',
                            value: message,
                            ignoreFieldChange: true
                        });

                        let id = externalCustomerRecord.save();

                        let confirmationForm = serverWidget.createForm({
                            title: 'Customer Created Externally'
                        });

                        confirmationForm.addField({
                            id: 'custpage_confirmation_page',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Confirmation'
                        }).defaultValue = `
                            <div>
                                <p>Record Id: ${id}</p>
                                <p>Name: ${name}</p>
                                <p>Email: ${customerEmail}</p>
                                <p>Subject: ${subject}</p>
                                <p>Message: ${message}</p>
                            </div>
                        `;

                        scriptContext.response.writePage({
                            pageObject: confirmationForm
                        });

                        email.send({
                            author: -5,
                            recipients: 'mfgfun031225pfd@oracle.com',
                            subject: 'External Customer Communication Record Created',
                            body: 'External Customer Communication Record Created. The id of the created record is ' + id
                        });

                        if(salesRepEmail){
                            email.send({
                                author: -5,
                                recipients: salesRepEmail,
                                subject: 'External Customer Communication Record Created',
                                body: 'External Customer Communication Record Created. The id of the created record is ' + id
                            });
                        } else {
                            log.debug('sales rep email is empty');
                        }
                    }
                } catch(error) {
                    log.debug('Unexpected error occured in else part(POST)', error.message);
                }
            } 
            
        }

        return {onRequest}
    });