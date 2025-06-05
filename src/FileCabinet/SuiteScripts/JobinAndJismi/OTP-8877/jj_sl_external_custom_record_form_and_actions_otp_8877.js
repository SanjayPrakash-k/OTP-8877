/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
/*************************************************************************************
 ***********
 *
 *
 * ${OTP-8877} : ${External Custom Record form and actions}
 *
 *
 **************************************************************************************
 ********
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 26-May-2025
 *
 * Description : This script is for creating custom record externally without having access to NetSuite. Fetch the details
 * through the form created using Suitelet and check the email already exist in the customer record. If the record 
 * do exist, link the record to the custom record. Lastly send emial to NetSuite admin and if salesrep available for the
 * linked customer, a notification mail will send to salesrep also.
 *
 *
 * REVISION HISTORY
 *
 * @version 1.0  :  26-May-2025:  The initial build was created by JJ0404
 *
 *
 *
 *************************************************************************************
 **********/
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
         * Defines the Suitelet script trigger point
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            if(scriptContext.request.method === 'GET'){
                createForm();
            } else {
                processEmailRequest();
            } 
        }

        return {onRequest}

        /**
        * Function to create form
        * @param {void}
        */
        function createForm(){
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
                log.error('Unexpected error occured while creating form', error.message);
            }
        }

        /**
        * Function to fetch and process email entered in the form
        * @param {void}
        */
        function processEmailRequest() {
            try{
                let name = scriptContext.request.parameters.custpage_name;
                let customerEmail = scriptContext.request.parameters.custpage_email || 'empty';
                let subject = scriptContext.request.parameters.custpage_subject;
                let message = scriptContext.request.parameters.custpage_message;

                searchAndCheckCustomerEmail(customerEmail);
            } catch(error) {
                log.error('Unexpected error occured when processing email', error.message);
            }
        }

        /**
        * Function to search and check the email of the customer exist or not and create record accordingly
        * @param {string} customerEmail: Email of customer if they already exist in the customer record
        */
        function searchAndCheckCustomerEmail(customerEmail){
            try{
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
                    createRecordAndSendEmail('', customerEmail, '');
                } else {
                    searchResult.forEach(function(result){
                        let internalId = result.getValue('internalid');
                        let customerEmail = result.getValue('email');
                        let salesRepEmail = result.getValue({name: "email", join: 'salesRep'});

                        createRecordAndSendEmail(internalId, customerEmail, salesRepEmail);
                    });
                }
            } catch(error) {
                log.error('Unexpected Error Occured During Checking Email', error.message);
            }
        }

        /**
        * Function to create custom record
        * @param {integer} internalId: Internal id of the customer if exist or null
        * @param {string} customerEmail: Email of the customer
        * @param {integer} salesRepEmail: Email of the sales rep if exist or null
        */
        function createRecordAndSendEmail(internalId, customerEmail, salesRepEmail) {
            try{
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
            } catch(error) {
                log.error('Unexpected error occured during creating record', error.message);
            }  
        }
    });